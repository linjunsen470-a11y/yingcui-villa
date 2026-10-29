import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FLOORS } from './plans';
import type { BuildingModel, Collider, DoorRuntime, FloorModel, FloorPlan, Materials, OpeningDef, Rect, WallDef } from './types';

const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const CLEAR=.2;

function box(parent:THREE.Group,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material,name=''):THREE.Mesh{
  const geometry=new THREE.BoxGeometry(Math.max(.005,w),Math.max(.005,h),Math.max(.005,d));
  // Metric texture coordinates: material pattern is independent of room size.
  const p=geometry.attributes.position, n=geometry.attributes.normal, uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    if(Math.abs(n.getY(i))>.5)uv.setXY(i,p.getX(i)+x,p.getZ(i)+z);
    else if(Math.abs(n.getX(i))>.5)uv.setXY(i,p.getZ(i)+z,p.getY(i)+y);
    else uv.setXY(i,p.getX(i)+x,p.getY(i)+y);
  }
  const mesh=new THREE.Mesh(geometry,material); mesh.position.set(x,y,z); mesh.name=name;
  mesh.castShadow=true;mesh.receiveShadow=true; parent.add(mesh);return mesh;
}
function pole(parent:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material,name=''){
  const delta=b.clone().sub(a);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name;parent.add(mesh);return mesh;
}
function subtractRect(r:Rect,hole:Rect|undefined):Rect[]{
  if(!hole||hole.x1>=r.x2||hole.x2<=r.x1||hole.z1>=r.z2||hole.z2<=r.z1)return[r];
  const x1=Math.max(r.x1,hole.x1),x2=Math.min(r.x2,hole.x2),z1=Math.max(r.z1,hole.z1),z2=Math.min(r.z2,hole.z2);
  return [
    {x1:r.x1,x2:x1,z1:r.z1,z2:r.z2},{x1:x2,x2:r.x2,z1:r.z1,z2:r.z2},
    {x1,x2,z1:r.z1,z2:z1},{x1,x2,z1:z2,z2:r.z2},
  ].filter(a=>a.x2-a.x1>.005&&a.z2-a.z1>.005);
}
function tileRect(parent:THREE.Group,r:Rect,y:number,h:number,material:THREE.Material,name:string,hole?:Rect){
  for(const a of subtractRect(r,hole))box(parent,a.x2-a.x1,h,a.z2-a.z1,(a.x1+a.x2)/2,y,(a.z1+a.z2)/2,material,name);
}
function colliderFor(plan:FloorPlan,w:WallDef,s:number,e:number,kind:Collider['kind']='wall',doorId?:string):Collider{
  const dx=w.b[0]-w.a[0],dz=w.b[1]-w.a[1],len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len,t=(w.thickness??.13)/2;
  const a=[w.a[0]+ux*s,w.a[1]+uz*s],b=[w.a[0]+ux*e,w.a[1]+uz*e];
  return {minX:Math.min(a[0],b[0])-Math.abs(uz)*t,maxX:Math.max(a[0],b[0])+Math.abs(uz)*t,minZ:Math.min(a[1],b[1])-Math.abs(ux)*t,maxZ:Math.max(a[1],b[1])+Math.abs(ux)*t,floorId:plan.id,kind,doorId};
}

function buildWall(floor:FloorModel,w:WallDef,m:Materials){
  const {plan,shell}=floor;
  const dx=w.b[0]-w.a[0],dz=w.b[1]-w.a[1],len=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx),th=w.thickness??.13,height=w.height??plan.height-CLEAR;
  const group=new THREE.Group();group.position.set(w.a[0],0,w.a[1]);group.rotation.y=angle;group.name=w.id;shell.add(group);
  const mat=w.exterior?m.exterior:m.wall;
  const part=(a:number,b:number,bottom:number,h:number)=>{
    if(b-a<.01||h<.01)return;
    const mesh=box(group,b-a,h,th,(a+b)/2,bottom+h/2,0,mat,`${w.id}-solid`);floor.wallMeshes.push(mesh);
  };
  const trim=(a:number,b:number)=>{
    if(b-a<.04)return;
    box(group,b-a,.085,th+.02,(a+b)/2,.045,0,m.woodDark,`${w.id}-skirting`);
  };
  const openings=(w.openings??[]).map(o=>({...o,offset:clamp(o.offset,0,len),width:Math.min(o.width,len-o.offset)})).filter(o=>o.width>.03).sort((a,b)=>a.offset-b.offset);
  let cursor=0;
  for(const o of openings){
    const start=o.offset,end=start+o.width;
    part(cursor,start,0,height);trim(cursor,start);
    if(start-cursor>.02)floor.colliders.push(colliderFor(plan,w,cursor,start));
    part(start,end,0,o.bottom); if(o.bottom>0)trim(start,end);
    part(start,end,o.bottom+o.height,height-o.bottom-o.height);
    if(o.type==='window'){
      floor.colliders.push(colliderFor(plan,w,start,end));
      buildWindow(group,o,th,m, !o.id.endsWith('back-main'));
    }else if(o.type==='door'){
      buildDoor(floor,group,w,o,angle,m);
    }
    cursor=Math.max(cursor,end);
  }
  part(cursor,len,0,height);trim(cursor,len);
  if(len-cursor>.02)floor.colliders.push(colliderFor(plan,w,cursor,len));
  // A continuous small cornice gives rooms a finished ceiling edge.
  box(group,len,.07,th+.035,len/2,height-.035,0,m.cream,`${w.id}-cornice`);
}

function buildWindow(group:THREE.Group,o:OpeningDef,th:number,m:Materials,glass=true){
  const {offset:s,width:w,bottom:y,height:h}=o;const f=.045;
  box(group,w+.08,.045,th+.12,s+w/2,y-.015,0,m.stone,`${o.id}-sill`);
  for(const x of [s+f/2,s+w-f/2])box(group,f,h,th+.025,x,y+h/2,0,m.metal,`${o.id}-jamb`);
  for(const v of [y+f/2,y+h-f/2])box(group,w,.045,th+.025,s+w/2,v,0,m.metal,`${o.id}-frame`);
  const panels=Math.max(1,Math.ceil(w/1.25));
  for(let i=1;i<panels;i++)box(group,.035,h,.055,s+w*i/panels,y+h/2,0,m.metal,`${o.id}-mullion`);
  if(glass)box(group,w-.07,h-.07,.018,s+w/2,y+h/2,0,m.glass,`${o.id}-glass`);
}

function buildDoor(floor:FloorModel,group:THREE.Group,w:WallDef,o:OpeningDef,wallAngle:number,m:Materials){
  const th=w.thickness??.13,s=o.offset,width=o.width,h=o.height;
  const glazed=o.id.includes('balcony')||o.id.includes('terrace')||o.id.includes('back-door');
  for(const x of [s-.025,s+width+.025])box(group,.055,h+.06,th+.055,x,h/2,0,glazed?m.metal:m.woodDark,`${o.id}-casing`);
  box(group,width+.11,.06,th+.055,s+width/2,h+.025,0,glazed?m.metal:m.woodDark,`${o.id}-lintel`);
  box(group,width,.018,th+.1,s+width/2,.008,0,m.stone,`${o.id}-threshold`);
  const double=width>1.35, count=double?2:1,leafWidth=width/count-.012;
  for(let i=0;i<count;i++){
    const end=(double&&i===1)||(!double&&o.hinge==='end'),side=end?-1:1,hingeX=end?s+width:s;
    const pivot=new THREE.Group();pivot.name=`${o.id}${double?`-${i+1}`:''}`;pivot.userData.dynamic=true;pivot.position.set(hingeX,0,0);group.add(pivot);
    const leaf=box(pivot,leafWidth,h-.035,.045,side*leafWidth/2,h/2,0,glazed?m.glass:m.oak,`${o.name??'房门'}-门扇`);
    leaf.userData.doorId=pivot.name;
    if(glazed){
      for(const x of [side*.025,side*(leafWidth-.025)])box(pivot,.04,h-.02,.06,x,h/2,0,m.metal,'门框');
      for(const y of [.035,h-.035])box(pivot,leafWidth,.045,.06,side*leafWidth/2,y,0,m.metal,'门框');
    }else{
      box(pivot,leafWidth-.11,h-.19,.008,side*leafWidth/2,h/2,.027,m.wood,'木门饰板');
      box(pivot,.016,h-.15,.012,side*(leafWidth-.12),h/2,.032,m.brass,'嵌铜饰条');
    }
    // Lever hardware remains attached to the animated leaf.
    for(const z of [-.052,.052]){
      box(pivot,.045,.16,.024,side*(leafWidth-.085),1.04,z,m.brass,'门把手底座');
      box(pivot,.13,.025,.028,side*(leafWidth-.13),1.07,z*1.4,m.brass,'门把手');
    }
    const c=colliderFor(floor.plan,w,end?s+width-leafWidth:s,(end?s+width:s+leafWidth),'door',pivot.name);
    const openAngle=(o.swing??1)*side*Math.PI*.49;
    pivot.rotation.y=openAngle;
    const runtime:DoorRuntime={id:pivot.name,name:o.name??'房门',floorId:floor.plan.id,pivot,leaf,closedAngle:0,openAngle,open:true,progress:1,collider:c};
    floor.doors.push(runtime);floor.colliders.push(c);
    // Include animated leaves in clipping without merging their hierarchy.
    floor.wallMeshes.push(leaf);
  }
  void wallAngle;
}

function glassRail(floor:FloorModel,a:[number,number],b:[number,number],m:Materials,height=1.05){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),g=new THREE.Group();g.position.set(a[0],0,a[1]);g.rotation.y=-Math.atan2(dz,dx);floor.shell.add(g);
  box(g,length,height-.10,.016,length/2,height/2+.015,0,m.glass,'安全夹胶玻璃栏板');
  box(g,length,.038,.045,length/2,height,0,m.brass,'阳台扶手');
  box(g,length,.055,.055,length/2,.035,0,m.metal,'栏杆底槽');
  const n=Math.max(1,Math.ceil(length/1.25));for(let i=0;i<=n;i++)box(g,.035,height,.035,length*i/n,height/2,0,m.metal,'栏杆立柱');
  floor.colliders.push({minX:Math.min(a[0],b[0])-.055,maxX:Math.max(a[0],b[0])+.055,minZ:Math.min(a[1],b[1])-.055,maxZ:Math.max(a[1],b[1])+.055,floorId:floor.plan.id,kind:'rail'});
}

function buildOutdoor(floor:FloorModel,m:Materials){
  const id=floor.plan.id;
  if(id==='F1'){
    glassRail(floor,[.05,10.5],[.05,12.6],m);glassRail(floor,[5.95,10.5],[5.95,12.6],m);
    // Front entrance remains open in the same x range as the living-room door.
    glassRail(floor,[.05,12.6],[3.05,12.6],m);glassRail(floor,[4.85,12.6],[5.95,12.6],m);
    glassRail(floor,[3.05,-1.5],[5.95,-1.5],m);glassRail(floor,[3.05,-1.5],[3.05,-.1],m);glassRail(floor,[5.95,-1.5],[5.95,-.1],m);
    for(let i=0;i<2;i++)box(floor.group,1.8,.12, .38,3.95,-.12-i*.12,12.85+i*.35,m.stone,'露台入口踏步');
  }
  if(id==='F2'||id==='F3'){
    glassRail(floor,[3.05,10.5],[3.05,11.8],m);glassRail(floor,[5.95,10.5],[5.95,11.8],m);glassRail(floor,[3.05,11.8],[5.95,11.8],m);
    // The 500 mm rear projection is a bay window, never a walkable balcony.
    box(floor.shell,3,.55,.5,4.5,.275,-1.85,m.exterior,'后侧凸窗窗台');
    const bay=new THREE.Group();bay.position.set(3,0,-2.1);floor.shell.add(bay);
    buildWindow(bay,{id:`${id}-bay-front`,offset:0,width:3,bottom:.55,height:1.95,type:'window'},.07,m);
    for(const x of [3,6]){
      const side=new THREE.Group();side.position.set(x,0,-2.1);side.rotation.y=-Math.PI/2;floor.shell.add(side);
      buildWindow(side,{id:`${id}-bay-side`,offset:0,width:.5,bottom:.55,height:1.95,type:'window'},.055,m);
    }
    box(floor.shell,3.08,.1,.57,4.5,2.55,-1.85,m.exterior,'凸窗顶板');
  }
  if(id==='F3'){
    glassRail(floor,[.05,-1.5],[1.8,-1.5],m);glassRail(floor,[.05,-1.5],[.05,-.05],m);
  }
  if(id==='AT'){
    glassRail(floor,[.05,5.6],[.05,7.4],m);glassRail(floor,[4.55,5.6],[4.55,7.4],m);glassRail(floor,[.05,7.4],[4.55,7.4],m);
  }
}

function buildStairs(floor:FloorModel,m:Materials){
  const {plan}=floor,r=plan.stair,stairs=new THREE.Group();stairs.name=`${plan.id}-实尺度折返楼梯`;floor.group.add(stairs);
  const width=(r.x2-r.x1-.16)/2,landingDepth=.6,front=r.z2-.14,back=r.z1+landingDepth,run=front-back;
  const rise=plan.height,half=rise/2,steps=Math.max(8,Math.ceil(half/.18)),tread=run/steps;
  if(plan.id!=='AT'){
    for(let i=0;i<steps;i++){
      const y=(i+1)*half/steps;
      box(stairs,width,.075,tread+.012,r.x1+width/2,y-.0375,front-(i+.5)*tread,m.oak,'下跑木饰面踏步');
      box(stairs,width,half/steps,tread*.06,r.x1+width/2,y-half/steps/2,front-i*tread,m.woodDark,'楼梯踢面');
      box(stairs,width,.075,tread+.012,r.x2-width/2,half+y-.0375,back+(i+.5)*tread,m.oak,'上跑木饰面踏步');
      box(stairs,width,half/steps,tread*.06,r.x2-width/2,half+y-half/steps/2,back+(i+1)*tread,m.woodDark,'楼梯踢面');
    }
    box(stairs,r.x2-r.x1,.1,landingDepth,(r.x1+r.x2)/2,half-.05,r.z1+landingDepth/2,m.oak,'楼梯转台');
    const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
    for(const x of [r.x1+.05,r.x1+width-.04]){
      pole(stairs,v(x,.82,front),v(x,half+.82,back),.021,m.brass,'下跑扶手');
      for(let i=0;i<=4;i++){const t=i/4;pole(stairs,v(x,half*t,front-run*t),v(x,half*t+.82,front-run*t),.012,m.metal,'扶手立杆');}
    }
    for(const x of [r.x2-width+.04,r.x2-.05]){
      pole(stairs,v(x,half+.82,back),v(x,rise+.82,front),.021,m.brass,'上跑扶手');
      for(let i=0;i<=4;i++){const t=i/4;pole(stairs,v(x,half+half*t,back+run*t),v(x,half+half*t+.82,back+run*t),.012,m.metal,'扶手立杆');}
    }
    // Sloping steel stringers keep the stair visually supported.
    for(const x of [r.x1+.12,r.x1+width-.12])pole(stairs,v(x,-.03,front),v(x,half-.03,back),.045,m.metal,'楼梯钢梁');
    for(const x of [r.x2-width+.12,r.x2-.12])pole(stairs,v(x,half-.03,back),v(x,rise-.03,front),.045,m.metal,'楼梯钢梁');
  }
  // Guard the slab opening; preserve the final 0.75 m as the landing access.
  if(plan.id!=='B1'){
    glassRail(floor,[r.x2+.04,r.z1+.05],[r.x2+.04,r.z2-.78],m,.97);
    glassRail(floor,[r.x1+.02,r.z1+.03],[r.x2+.04,r.z1+.03],m,.97);
  }
}

function slabHole(plan:FloorPlan):Rect|undefined{
  if(plan.id==='B1')return undefined;
  const below=FLOORS[plan.index-1].stair;
  // Reserve a 0.75 m landing at the front of the staircase. In particular this
  // is the real floor in front of F3's original wardrobe door, not a void.
  return {x1:below.x1-.035,x2:below.x2+.035,z1:below.z1-.02,z2:below.z2-.75};
}

function buildFloors(floor:FloorModel,m:Materials){
  const {plan}=floor,hole=slabHole(plan),surfaces=new THREE.Group();surfaces.name='楼面与楼板';floor.group.add(surfaces);
  for(const r of plan.slabs){
    tileRect(surfaces,r,-.1,.2,m.concrete,'200mm结构楼板',hole);
    tileRect(surfaces,r,.006,.014,m.wood,'基础木饰面楼面',hole);
  }
  for(const r of plan.rooms){
    const exterior=r.kind==='terrace'||r.kind==='balcony';
    const material=exterior?m.woodDark:r.kind==='bathroom'?m.tile:r.kind==='wine'?m.woodDark:
      r.kind==='kitchen'||r.kind==='dining'||r.kind==='multi'||(r.kind==='living'&&plan.id!=='AT')?m.stone:m.oak;
    tileRect(surfaces,r,.018,.016,material,`${r.name}地面`,hole);
  }
  // Finite ceilings are hidden independently for plan/cutaway views.
  const main:Rect=plan.id==='AT'?{x1:0,x2:4.6,z1:-.5,z2:5.5}:plan.id==='B1'||plan.id==='F1'?{x1:0,x2:6,z1:0,z2:10.4}:{x1:0,x2:6,z1:-1.6,z2:10.4};
  for(const r of subtractRect(main,plan.id==='AT'?undefined:plan.stair)){
    box(floor.ceilings,r.x2-r.x1,.055,r.z2-r.z1,(r.x1+r.x2)/2,plan.height-.23,(r.z1+r.z2)/2,m.cream,'室内平顶');
  }
  // Exterior stone slab-edge band articulates the five distinct levels.
  for(const r of plan.slabs){
    box(surfaces,r.x2-r.x1,.14,.09,(r.x1+r.x2)/2,-.085,r.z1,m.exterior,'楼板水平饰带');
    box(surfaces,r.x2-r.x1,.14,.09,(r.x1+r.x2)/2,-.085,r.z2,m.exterior,'楼板水平饰带');
  }
  if(plan.id==='AT'){
    box(floor.roof,4.9,.18,6.3,2.3,plan.height-.08,2.5,m.exterior,'推定阁楼平屋面');
    box(floor.roof,4.82,.035,6.22,2.3,plan.height+.026,2.5,m.woodDark,'屋面防水层');
    for(const x of [-.11,4.71])box(floor.roof,.075,.19,6.25,x,plan.height+.08,2.5,m.metal,'屋面收边');
  }
}

// Batch static architecture by material to keep the furnished five-storey
// scene practical in a desktop browser. Animated door hierarchies stay intact.
function mergeStatic(group:THREE.Group):THREE.Mesh[]{
  group.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets=new Map<THREE.Material,{g:THREE.BufferGeometry[];meshes:THREE.Mesh[]}>();
  const visit=(object:THREE.Object3D)=>{
    if(object.userData.dynamic)return;
    if(object instanceof THREE.Mesh&&object.material instanceof THREE.Material){
      let b=buckets.get(object.material);if(!b){b={g:[],meshes:[]};buckets.set(object.material,b);}
      const geometry=object.geometry.clone();geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));b.g.push(geometry);b.meshes.push(object);
    }
    for(const child of object.children)visit(child);
  };visit(group);
  const result:THREE.Mesh[]=[];
  for(const [material,b] of buckets){
    if(!b.g.length)continue;const geo=mergeGeometries(b.g,false);if(!geo)continue;
    const mesh=new THREE.Mesh(geo,material);mesh.name=`静态批次-${material.name||material.uuid.slice(0,5)}`;mesh.castShadow=true;mesh.receiveShadow=true;
    for(const old of b.meshes){old.removeFromParent();old.geometry.dispose();}for(const g of b.g)g.dispose();group.add(mesh);result.push(mesh);
  }
  return result;
}

export function buildArchitecture(m:Materials):BuildingModel{
  const root=new THREE.Group();root.name='合盛·盈翠雅筑｜五层住宅';
  const floors:FloorModel[]=FLOORS.map(plan=>{
    const group=new THREE.Group(),shell=new THREE.Group(),ceilings=new THREE.Group(),roof=new THREE.Group();
    group.name=`${plan.id} ${plan.name}`;group.position.y=plan.elevation;shell.name='墙体门窗与护栏';ceilings.name='可独立隐藏的吊顶';roof.name='可独立隐藏的屋面';
    group.add(shell,ceilings,roof);root.add(group);
    const floor:FloorModel={plan,group,shell,ceilings,roof,wallMeshes:[],doors:[],colliders:[]};
    buildFloors(floor,m);for(const w of plan.walls)buildWall(floor,w,m);buildOutdoor(floor,m);buildStairs(floor,m);
    // All static shell members participate in cutaway clipping, including glass.
    const animated=floor.doors.map(d=>d.leaf);floor.wallMeshes=[...mergeStatic(shell),...animated];
    for(const child of [...group.children])if(child instanceof THREE.Group&&child!==shell)mergeStatic(child);
    return floor;
  });
  return {root,floors};
}
