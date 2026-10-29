import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials } from './materials';
import { buildArchitecture } from './architecture';
import { furnishFloor } from './furniture';
import { FLOORS, ROOMS } from './plans';
import type { BuildingModel, CameraMode, Collider, DoorRuntime, FloorId, RoomDef, ViewerState, ViewerStats } from './types';

type Callbacks={onStateChange?:(patch:Partial<ViewerState>)=>void;onStats?:(stats:ViewerStats)=>void;onReady?:()=>void;onNotice?:(text:string)=>void;onError?:(text:string)=>void};
const DEFAULT:ViewerState={floorId:'F1',viewMode:'floor',cameraMode:'orbit',cutaway:true,labels:true,dimensions:false,lights:true,quality:'balanced',selectedRoom:null};
const EYE_HEIGHT=1.64, RADIUS=.19, EXPLODE_GAP=2.6;
const ease=(t:number)=>1-Math.pow(1-t,3);

export class VillaViewer {
  private container:HTMLElement;
  private callbacks:Callbacks;
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(43,1,.045,300);
  private renderer:THREE.WebGLRenderer;
  private controls:OrbitControls;
  private building:BuildingModel;
  private state:ViewerState={...DEFAULT};
  private keys=new Set<string>();
  private yaw=0; private pitch=0;
  private frame=0;private disposed=false;private lastTime=0;private statsTime=0;private frames=0;
  private labelLayer:HTMLDivElement;
  private roomLabels=new Map<string,HTMLButtonElement>();
  private levelLabels=new Map<FloorId,HTMLButtonElement>();
  private dimensionLabels:HTMLDivElement[]=[];
  private dimensions=new THREE.Group();
  private selected=new THREE.Group();
  private shadowGround:THREE.Mesh;
  private sun:THREE.DirectionalLight;
  private sky:THREE.HemisphereLight;
  private indoor:THREE.PointLight[]=[];
  private resizeObserver:ResizeObserver;
  private raycaster=new THREE.Raycaster();
  private down={x:0,y:0,time:0};private dragging=false;private dragX=0;private dragY=0;
  private wasLocked=false;
  private transition:null|{from:THREE.Vector3,to:THREE.Vector3,fromTarget:THREE.Vector3,target:THREE.Vector3,start:number,duration:number}=null;
  private wallMaterials:THREE.Material[][]=[];
  private composer:EffectComposer|null=null;
  private ssao:SSAOPass|null=null;
  private ready=false;
  private cleanups:Array<()=>void>=[];
  private doorBoxes=new Map<string,Collider>();
  private terrain:THREE.Group;
  private latestPosition=new THREE.Vector3();
  private moveTime=0;

  constructor(container:HTMLElement,callbacks:Callbacks={}){
    this.container=container;this.callbacks=callbacks;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));
    this.renderer.setClearColor('#f0f0e9',0);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.96;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled=true;
    this.renderer.domElement.setAttribute('aria-label','五层住宅三维模型，可拖动旋转，滚轮缩放，双击房间进入漫游');
    this.renderer.domElement.tabIndex=0;
    this.container.append(this.renderer.domElement);
    const pmrem=new THREE.PMREMGenerator(this.renderer);const roomEnvironment=new RoomEnvironment();
    const env=pmrem.fromScene(roomEnvironment,.035);this.scene.environment=env.texture;this.scene.environmentIntensity=.6;roomEnvironment.dispose();pmrem.dispose();
    this.cleanups.push(()=>env.dispose());
    const m=createMaterials();this.building=buildArchitecture(m);this.building.root.name='合盛·盈翠雅筑_米制模型';
    this.building.root.userData={project:'合盛·盈翠雅筑',units:'meters',source:'用户提供的营销户型图',reference:'floorplan.jpg',accuracy:'按标注与比例重建，非施工BIM',floors:5};
    this.building.floors.forEach((floor,i)=>{
      const furniture=furnishFloor(floor.plan,m);floor.group.add(furniture.group);floor.colliders.push(...furniture.colliders);
      floor.group.userData.floorId=floor.plan.id;floor.group.userData.elevation=floor.plan.elevation;
      const mats=new Map<string,THREE.Material>();
      floor.shell.traverse(obj=>{if(obj instanceof THREE.Mesh){const cloneMat=(mat:THREE.Material)=>{if(!mats.has(mat.uuid))mats.set(mat.uuid,mat.clone());return mats.get(mat.uuid)!;};obj.material=Array.isArray(obj.material)?obj.material.map(cloneMat):cloneMat(obj.material);}});
      this.wallMaterials[i]=[...mats.values()];
      floor.group.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.castShadow=true;obj.receiveShadow=true;if((obj.material as THREE.Material)?.transparent)obj.castShadow=false;}});
    });
    this.scene.add(this.building.root);
    this.sky=new THREE.HemisphereLight('#fffaf0','#b0ab9b',1.15);this.scene.add(this.sky);
    this.sun=new THREE.DirectionalLight('#fff0d5',2.65);this.sun.position.set(11,25,18);this.sun.target.position.set(3,1,5);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-19;this.sun.shadow.camera.right=19;this.sun.shadow.camera.top=23;this.sun.shadow.camera.bottom=-18;this.sun.shadow.camera.near=.5;this.sun.shadow.camera.far=80;this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.025;
    this.scene.add(this.sun,this.sun.target);
    const fill=new THREE.DirectionalLight('#ddebe7',.65);fill.position.set(-10,14,-12);this.scene.add(fill);
    for(let i=0;i<3;i++){const l=new THREE.PointLight('#ffdcab',5,11,2);this.indoor.push(l);this.scene.add(l);}
    this.shadowGround=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#5b6258',opacity:.13}));this.shadowGround.rotation.x=-Math.PI/2;this.shadowGround.receiveShadow=true;this.scene.add(this.shadowGround);
    this.terrain=this.createLandscape();this.scene.add(this.terrain);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.075;this.controls.minDistance=2.5;this.controls.maxDistance=85;this.controls.maxPolarAngle=Math.PI*.49;this.controls.screenSpacePanning=true;this.controls.target.set(3,.4,5.4);
    this.controls.addEventListener('start',()=>{this.transition=null;});
    this.labelLayer=document.createElement('div');this.labelLayer.className='world-labels';this.container.append(this.labelLayer);this.makeLabels();
    this.scene.add(this.dimensions,this.selected);
    this.bindEvents();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
    this.applyState(true);this.ready=true;
    this.lastTime=performance.now();this.statsTime=this.lastTime;this.frame=requestAnimationFrame(this.animate);
    setTimeout(()=>{if(!this.disposed)this.callbacks.onReady?.();},100);
  }

  private createLandscape(){
    const g=new THREE.Group();g.name='展示场地';
    const stone=new THREE.MeshStandardMaterial({color:'#d8d5c7',roughness:.95});
    const p=new THREE.Mesh(new THREE.BoxGeometry(10,.13,17),stone);p.position.set(3,-3.26,5);p.receiveShadow=true;g.add(p);
    const lineMaterial=new THREE.LineBasicMaterial({color:'#bcb9ab',transparent:true,opacity:.4});
    for(let z=-3;z<14;z+=1){const geom=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2,-3.19,z),new THREE.Vector3(8,-3.19,z)]);g.add(new THREE.Line(geom,lineMaterial));}
    return g;
  }

  private makeLabels(){
    for(const room of ROOMS){const b=document.createElement('button');b.className='room-tag';b.innerHTML=`<span>${room.name}</span><small>${this.area(room).toFixed(1)} ㎡</small>`;b.title='点击查看空间，双击进入';b.addEventListener('click',ev=>{ev.stopPropagation();this.selectRoom(room.id);});b.addEventListener('dblclick',ev=>{ev.stopPropagation();this.focusRoom(room.id,true);});this.labelLayer.append(b);this.roomLabels.set(room.id,b);}
    for(const f of FLOORS){const b=document.createElement('button');b.className='level-label';b.textContent=`${f.shortName} · ${f.name}  ${f.elevation>=0?'+':''}${f.elevation.toFixed(2)} m`;b.addEventListener('click',()=>this.setState({...this.state,floorId:f.id,viewMode:'floor',cameraMode:'orbit'}));this.labelLayer.append(b);this.levelLabels.set(f.id,b);}
    for(let i=0;i<2;i++){const label=document.createElement('div');label.className='measure-label';this.labelLayer.append(label);this.dimensionLabels.push(label);}
  }

  private area(room:RoomDef){return room.area??Math.max(0,(room.x2-room.x1-.16)*(room.z2-room.z1-.16));}

  setState(next:ViewerState){
    const old=this.state;this.state={...next};
    if(next.cameraMode==='walk'&&old.cameraMode!=='walk'){this.startWalk();return;}
    if(old.cameraMode==='walk'&&next.cameraMode!=='walk'){if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();this.keys.clear();}
    const change=old.floorId!==next.floorId||old.viewMode!==next.viewMode||old.cameraMode!==next.cameraMode;
    this.applyState(change);
    if(old.floorId!==next.floorId&&next.cameraMode==='walk')this.placeInRoom(this.defaultRoom(next.floorId));
  }

  private emit(patch:Partial<ViewerState>){this.state={...this.state,...patch};this.callbacks.onStateChange?.(patch);}

  private applyState(reframe=false){
    const s=this.state,active=this.floor();
    this.building.floors.forEach((floor,i)=>{
      const visible=s.cameraMode==='walk'||s.viewMode!=='floor'||floor.plan.id===s.floorId;floor.group.visible=visible;
      floor.group.position.y=floor.plan.elevation+(s.viewMode==='exploded'?i*EXPLODE_GAP:0);
      floor.ceilings.visible=s.cameraMode==='walk'||s.viewMode==='building';
      floor.roof.visible=s.viewMode==='building'||s.cameraMode==='walk';
      const cut=s.cameraMode!=='walk'&&s.viewMode!=='building'&&s.cutaway;
      const plane=new THREE.Plane(new THREE.Vector3(0,-1,0),floor.group.position.y+(s.cameraMode==='plan'?.75:1.15));
      for(const mat of this.wallMaterials[i]){mat.clippingPlanes=cut?[plane]:[];mat.clipShadows=true;mat.needsUpdate=true;}
    });
    this.terrain.visible=s.viewMode==='building';
    this.shadowGround.position.y=s.viewMode==='floor'?active.elevation-.24:-3.34;
    this.controls.enabled=s.cameraMode!=='walk';this.controls.enableRotate=s.cameraMode!=='plan';this.controls.maxPolarAngle=s.cameraMode==='plan'?.001:Math.PI*.49;this.controls.minPolarAngle=0;
    this.labelLayer.classList.toggle('walking',s.cameraMode==='walk');
    this.sun.intensity=s.lights?2.65:.22;this.sky.intensity=s.lights?1.15:.6;this.scene.environmentIntensity=s.lights?.6:.3;this.renderer.toneMappingExposure=s.lights?.96:1.05;
    this.sun.position.set(11,25+active.elevation,18);this.sun.target.position.set(3,active.elevation,5);
    this.indoor.forEach((light,i)=>{light.visible=s.viewMode==='floor';light.position.set(i===1?4.5:2.8,active.elevation+active.height-.5,[-.1,4.2,8.2][i]);light.intensity=s.lights?4:13;});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,s.quality==='high'?2:1.5));
    if(s.quality==='high'&&!this.composer)this.createComposer();
    this.updateDimensions();this.updateSelection();
    if(reframe&&s.cameraMode!=='walk')this.resetCamera();
    this.resize();
  }

  private createComposer(){
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.ssao=new SSAOPass(this.scene,this.camera,this.container.clientWidth,this.container.clientHeight);this.ssao.kernelRadius=.14;this.ssao.minDistance=.0004;this.ssao.maxDistance=.035;this.composer.addPass(this.ssao);this.composer.addPass(new OutputPass());
  }
  private floor(){return FLOORS.find(f=>f.id===this.state.floorId)!;}
  private floorModel(){return this.building.floors.find(f=>f.plan.id===this.state.floorId)!;}
  private defaultRoom(id:FloorId){return ROOMS.find(r=>r.id===({B1:'B1-leisure',F1:'F1-living',F2:'F2-master',F3:'F3-living',AT:'AT-lounge'}[id]))??ROOMS.find(r=>r.floorId===id)!;}

  resetCamera(){
    this.transition=null;
    const f=this.floor();
    if(this.state.cameraMode==='walk'){this.placeInRoom(this.defaultRoom(f.id));return;}
    this.camera.fov=this.state.cameraMode==='plan'?37:43;this.camera.updateProjectionMatrix();
    let target:THREE.Vector3,position:THREE.Vector3;
    if(this.state.viewMode==='floor'){
      const bounds=f.bounds;const all=f.slabs;const z1=Math.min(bounds.z1,...all.map(r=>r.z1)),z2=Math.max(bounds.z2,...all.map(r=>r.z2));
      target=new THREE.Vector3((bounds.x1+bounds.x2)/2,f.elevation+.3,(z1+z2)/2);
      if(this.state.cameraMode==='plan'){position=target.clone().add(new THREE.Vector3(0,22,.001));}
      else {const factor=Math.max(1,(z2-z1)/13);position=target.clone().add(new THREE.Vector3(10.6,13.4,14.5).multiplyScalar(factor));}
    }else{
      target=new THREE.Vector3(3,this.state.viewMode==='exploded'?10.2:3.8,4.7);
      position=target.clone().add(this.state.viewMode==='exploded'?new THREE.Vector3(24,18,31).multiplyScalar(1.18):new THREE.Vector3(19,13,24).multiplyScalar(1.08));
    }
    if(this.camera.aspect<.85)position.sub(target).multiplyScalar(1.25).add(target);
    this.camera.position.copy(position);this.controls.target.copy(target);this.camera.lookAt(target);this.controls.update();
  }

  private selectRoom(id:string){const r=ROOMS.find(x=>x.id===id);if(!r)return;this.emit({selectedRoom:id,floorId:r.floorId});this.updateSelection();}

  focusRoom(id:string,enter=false){
    const room=ROOMS.find(r=>r.id===id);if(!room)return;
    if(enter){this.emit({floorId:room.floorId,selectedRoom:id,viewMode:'floor',cameraMode:'walk',cutaway:false});this.applyState();this.placeInRoom(room);this.requestLock();return;}
    if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();
    this.emit({floorId:room.floorId,selectedRoom:id,viewMode:'floor',cameraMode:'orbit',cutaway:true});this.applyState();
    const target=new THREE.Vector3((room.x1+room.x2)/2,this.floor().elevation+.3,(room.z1+room.z2)/2);
    const size=Math.max(room.x2-room.x1,room.z2-room.z1,2.5);
    const to=target.clone().add(new THREE.Vector3(size*.95,size*1.45,size*1.45));
    this.transition={from:this.camera.position.clone(),to,fromTarget:this.controls.target.clone(),target,start:performance.now(),duration:650};
  }

  startWalk(){
    const room=ROOMS.find(r=>r.id===this.state.selectedRoom&&r.floorId===this.state.floorId)??this.defaultRoom(this.state.floorId);
    this.emit({cameraMode:'walk',viewMode:'floor',cutaway:false,dimensions:false,selectedRoom:room.id});this.applyState();this.placeInRoom(room);this.requestLock();
  }
  stopWalk(){
    if(this.state.cameraMode!=='walk')return;
    this.keys.clear();this.emit({cameraMode:'orbit',cutaway:true});if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();this.applyState(true);
  }

  private requestLock(){
    this.renderer.domElement.focus();
    if(document.pointerLockElement===this.renderer.domElement)return;
    try{const p=this.renderer.domElement.requestPointerLock?.();if(p&&typeof p.catch==='function')p.catch(()=>this.callbacks.onNotice?.('已进入漫游。单击画面锁定鼠标；也可按住鼠标拖动转头。'));}catch{this.callbacks.onNotice?.('按住鼠标拖动转头，WASD 行走。');}
  }

  private placeInRoom(room:RoomDef){
    const p=this.safePoint(room.spawn[0],room.spawn[1],room);this.camera.fov=68;this.camera.updateProjectionMatrix();this.camera.position.set(p[0],this.floor().elevation+EYE_HEIGHT,p[1]);
    const dx=room.look[0]-p[0],dz=room.look[1]-p[1];this.yaw=Math.atan2(-dx,-dz);this.pitch=-.04;this.updateLook();this.transition=null;this.keys.clear();
  }
  private safePoint(x:number,z:number,room?:RoomDef):[number,number]{
    this.updateDoorBoxes();if(!this.blocked(x,z))return[x,z];
    for(let radius=.25;radius<4;radius+=.23)for(let k=0;k<24;k++){const px=x+Math.cos(k*Math.PI/12)*radius,pz=z+Math.sin(k*Math.PI/12)*radius;if(room&&(px<room.x1+.23||px>room.x2-.23||pz<room.z1+.23||pz>room.z2-.23))continue;if(!this.blocked(px,pz))return[px,pz];}
    for(const r of ROOMS.filter(r=>r.floorId===this.state.floorId))for(let px=r.x1+.35;px<r.x2-.3;px+=.35)for(let pz=r.z1+.35;pz<r.z2-.3;pz+=.35)if(!this.blocked(px,pz))return[px,pz];
    return[x,z];
  }
  private updateLook(){this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');}

  changeFloor(delta:number){
    const i=FLOORS.findIndex(f=>f.id===this.state.floorId),next=FLOORS[i+delta];if(!next){this.callbacks.onNotice?.(delta>0?'已到达阁楼':'已到达地下室');return;}
    const walk=this.state.cameraMode==='walk';this.emit({floorId:next.id,selectedRoom:null,viewMode:'floor'});this.applyState(!walk);
    if(walk){const p=this.safePoint(2.32,5.2);this.camera.position.set(p[0],next.elevation+EYE_HEIGHT,p[1]);this.yaw=-Math.PI/2;this.pitch=0;this.updateLook();this.keys.clear();}
    this.callbacks.onNotice?.(`已到达${next.name}`);
  }

  private doors(){return this.building.floors.flatMap(f=>f.doors);}
  private nearestDoor(){let door:DoorRuntime|null=null,best=1.8;for(const d of this.floorModel().doors){const c=d.collider;const distance=Math.hypot((c.minX+c.maxX)/2-this.camera.position.x,(c.minZ+c.maxZ)/2-this.camera.position.z);if(distance<best){best=distance;door=d;}}return door;}
  toggleDoor(){const d=this.nearestDoor();if(!d){this.callbacks.onNotice?.('走近门口后，按 E 开门或关门');return;}if(d.open){const c=d.collider;if(this.circleHits(this.camera.position.x,this.camera.position.z,c,.34)){this.callbacks.onNotice?.('请稍离开门洞后再关门');return;}}d.open=!d.open;this.callbacks.onNotice?.(`${d.name} · ${d.open?'已开门':'已关门'}`);}

  private updateDoorBoxes(){
    this.building.root.updateMatrixWorld(true);this.doorBoxes.clear();
    for(const d of this.floorModel().doors){const b=new THREE.Box3().setFromObject(d.leaf);this.doorBoxes.set(d.id,{minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,floorId:d.floorId,kind:'door',doorId:d.id});}
  }
  private circleHits(x:number,z:number,c:Collider,r=RADIUS){const px=Math.max(c.minX,Math.min(x,c.maxX)),pz=Math.max(c.minZ,Math.min(z,c.maxZ));return (x-px)**2+(z-pz)**2<r*r;}
  private blocked(x:number,z:number){
    const f=this.floor(),inside=(px:number,pz:number)=>f.slabs.some(r=>px>=r.x1&&px<=r.x2&&pz>=r.z1&&pz<=r.z2);
    // Test the union of touching slabs so balcony thresholds never acquire a gap.
    if(!inside(x,z)||!inside(x-RADIUS,z)||!inside(x+RADIUS,z)||!inside(x,z-RADIUS)||!inside(x,z+RADIUS))return true;
    for(const c of this.floorModel().colliders){if(c.kind==='door')continue;if(this.circleHits(x,z,c))return true;}
    for(const c of this.doorBoxes.values())if(this.circleHits(x,z,c))return true;
    // The drawing does not give stair risers. Keep the avatar on safe landings;
    // use the staircase's R/F navigation rather than an invented stair slope.
    if(x>f.stair.x1-.1&&x<f.stair.x2+.08&&z>f.stair.z1-.05&&z<f.stair.z2-.75)return true;
    return false;
  }

  private move(dt:number){
    if(this.state.cameraMode!=='walk')return;
    let f=0,s=0;if(this.keys.has('KeyW')||this.keys.has('ArrowUp'))f++;if(this.keys.has('KeyS')||this.keys.has('ArrowDown'))f--;if(this.keys.has('KeyD')||this.keys.has('ArrowRight'))s++;if(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))s--;
    if(f||s){const len=Math.hypot(f,s),speed=(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?3.2:1.8)*dt;const dx=(-Math.sin(this.yaw)*f+Math.cos(this.yaw)*s)/len*speed,dz=(-Math.cos(this.yaw)*f-Math.sin(this.yaw)*s)/len*speed;
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.055));
      for(let i=0;i<steps;i++){const x=this.camera.position.x+dx/steps,z=this.camera.position.z+dz/steps;if(!this.blocked(x,this.camera.position.z))this.camera.position.x=x;if(!this.blocked(this.camera.position.x,z))this.camera.position.z=z;}
      this.moveTime+=dt;this.camera.position.y=this.floor().elevation+EYE_HEIGHT+Math.sin(this.moveTime*9)*.012;
    }else{this.camera.position.y=this.floor().elevation+EYE_HEIGHT;this.moveTime=0;}
  }

  private roomAt(x:number,z:number,floorId:FloorId){return ROOMS.filter(r=>r.floorId===floorId&&x>=r.x1&&x<=r.x2&&z>=r.z1&&z<=r.z2).sort((a,b)=>this.area(a)-this.area(b))[0]??null;}

  private bindEvents(){
    const on=(target:EventTarget,event:string,fn:(ev:any)=>void)=>{target.addEventListener(event,fn as EventListener);this.cleanups.push(()=>target.removeEventListener(event,fn as EventListener));};
    on(window,'keydown',(ev:KeyboardEvent)=>{if((ev.target as HTMLElement)?.closest('input,textarea,select'))return;if(this.state.cameraMode!=='walk')return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(ev.code))ev.preventDefault();this.keys.add(ev.code);if(ev.repeat)return;if(ev.code==='KeyE')this.toggleDoor();if(ev.code==='KeyR')this.changeFloor(1);if(ev.code==='KeyF')this.changeFloor(-1);if(ev.code==='Escape')this.stopWalk();});
    on(window,'keyup',(ev:KeyboardEvent)=>this.keys.delete(ev.code));on(window,'blur',()=>{this.keys.clear();});
    on(document,'pointerlockchange',()=>{const locked=document.pointerLockElement===this.renderer.domElement;if(this.wasLocked&&!locked&&this.state.cameraMode==='walk')this.stopWalk();this.wasLocked=locked;});
    on(document,'mousemove',(ev:MouseEvent)=>{if(this.state.cameraMode!=='walk')return;if(document.pointerLockElement===this.renderer.domElement){this.yaw-=ev.movementX*.0022;this.pitch=THREE.MathUtils.clamp(this.pitch-ev.movementY*.0022,-1.48,1.48);this.updateLook();}});
    on(this.renderer.domElement,'pointerdown',(ev:PointerEvent)=>{this.down={x:ev.clientX,y:ev.clientY,time:performance.now()};this.dragX=ev.clientX;this.dragY=ev.clientY;this.dragging=true;if(this.state.cameraMode==='walk'&&ev.pointerType!=='touch')this.requestLock();});
    on(this.renderer.domElement,'pointermove',(ev:PointerEvent)=>{if(this.state.cameraMode==='walk'&&this.dragging&&document.pointerLockElement!==this.renderer.domElement){this.yaw-=(ev.clientX-this.dragX)*.004;this.pitch=THREE.MathUtils.clamp(this.pitch-(ev.clientY-this.dragY)*.004,-1.45,1.45);this.updateLook();}this.dragX=ev.clientX;this.dragY=ev.clientY;});
    on(window,'pointerup',(ev:PointerEvent)=>{this.dragging=false;if(this.state.cameraMode==='walk'||ev.button!==0||ev.target!==this.renderer.domElement)return;if(Math.hypot(ev.clientX-this.down.x,ev.clientY-this.down.y)>6)return;this.pick(ev,false);});
    on(this.renderer.domElement,'dblclick',(ev:MouseEvent)=>{if(this.state.cameraMode==='walk'){this.toggleDoor();return;}this.pick(ev,true);});
    on(this.renderer.domElement,'contextmenu',(ev:MouseEvent)=>ev.preventDefault());
    on(document,'visibilitychange',()=>{if(document.hidden)this.keys.clear();});
    on(this.renderer.domElement,'webglcontextlost',(ev:Event)=>{ev.preventDefault();this.callbacks.onError?.('浏览器暂停了图形渲染，请刷新页面恢复。');});
  }

  private pick(ev:MouseEvent|PointerEvent,enter:boolean){
    const rect=this.renderer.domElement.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((ev.clientX-rect.left)/rect.width*2-1,-(ev.clientY-rect.top)/rect.height*2+1),this.camera);
    const hits=this.raycaster.intersectObject(this.building.root,true);
    for(const h of hits){let p:THREE.Object3D|null=h.object,visible=true,floorId:FloorId|null=null;while(p){if(!p.visible)visible=false;if(p.userData.floorId)floorId=p.userData.floorId;p=p.parent;}if(!visible||!floorId)continue;
      const fi=this.building.floors.findIndex(f=>f.plan.id===floorId);const floor=this.building.floors[fi];const cut=this.state.cameraMode!=='walk'&&this.state.viewMode!=='building'&&this.state.cutaway;let inShell=false;for(let o:THREE.Object3D|null=h.object;o;o=o.parent)if(o===floor.shell)inShell=true;
      if(cut&&inShell&&h.point.y>floor.group.position.y+(this.state.cameraMode==='plan'?.75:1.15))continue;
      const room=this.roomAt(h.point.x,h.point.z,floorId);if(room){if(enter)this.focusRoom(room.id,true);else this.selectRoom(room.id);return;}
    }
  }

  private updateSelection(){
    for(const child of [...this.selected.children]){this.selected.remove(child);if(child instanceof THREE.Mesh||child instanceof THREE.Line){child.geometry.dispose();(child.material as THREE.Material).dispose();}}
    const r=ROOMS.find(r=>r.id===this.state.selectedRoom);if(!r||this.state.cameraMode==='walk')return;
    const f=this.building.floors.find(f=>f.plan.id===r.floorId)!;const y=f.group.position.y+.035;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(r.x2-r.x1-.2,r.z2-r.z1-.2),new THREE.MeshBasicMaterial({color:'#adbe91',transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.set((r.x1+r.x2)/2,y,(r.z1+r.z2)/2);this.selected.add(mesh);
    const pts=[[r.x1+.1,r.z1+.1],[r.x2-.1,r.z1+.1],[r.x2-.1,r.z2-.1],[r.x1+.1,r.z2-.1],[r.x1+.1,r.z1+.1]].map(([x,z])=>new THREE.Vector3(x,y+.005,z));this.selected.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#829874'})));
  }

  private updateDimensions(){
    for(const c of [...this.dimensions.children]){this.dimensions.remove(c);if(c instanceof THREE.LineSegments){c.geometry.dispose();(c.material as THREE.Material).dispose();}}
    const f=this.floor(),r=f.bounds,y=f.elevation+.035,z=r.z2+.65,x=r.x2+.65;
    const pts=[new THREE.Vector3(r.x1,y,z),new THREE.Vector3(r.x2,y,z),new THREE.Vector3(r.x1,y,z-.15),new THREE.Vector3(r.x1,y,z+.15),new THREE.Vector3(r.x2,y,z-.15),new THREE.Vector3(r.x2,y,z+.15),new THREE.Vector3(x,y,r.z1),new THREE.Vector3(x,y,r.z2),new THREE.Vector3(x-.15,y,r.z1),new THREE.Vector3(x+.15,y,r.z1),new THREE.Vector3(x-.15,y,r.z2),new THREE.Vector3(x+.15,y,r.z2)];
    this.dimensions.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#9a8a6b'})));this.dimensions.visible=this.state.dimensions&&this.state.viewMode==='floor';
    this.dimensionLabels[0].textContent=`${(r.x2-r.x1).toFixed(2)} m`;this.dimensionLabels[1].textContent=`${(r.z2-r.z1).toFixed(2)} m`;
  }

  private project(element:HTMLElement,pos:THREE.Vector3,visible:boolean){
    if(!visible){element.style.display='none';return;}const v=pos.clone().project(this.camera);if(v.z>1||v.z<-1||Math.abs(v.x)>1.15||Math.abs(v.y)>1.15){element.style.display='none';return;}element.style.display='';element.style.left=`${(v.x*.5+.5)*this.container.clientWidth}px`;element.style.top=`${(-v.y*.5+.5)*this.container.clientHeight}px`;
  }
  private updateLabels(){
    const s=this.state;
    for(const room of ROOMS){const label=this.roomLabels.get(room.id)!;const f=this.building.floors.find(f=>f.plan.id===room.floorId)!;const show=s.labels&&s.cameraMode!=='walk'&&s.viewMode==='floor'&&s.floorId===room.floorId;label.classList.toggle('selected',room.id===s.selectedRoom);this.project(label,new THREE.Vector3((room.x1+room.x2)/2,f.group.position.y+.08,(room.z1+room.z2)/2),show);}
    for(const floor of this.building.floors)this.project(this.levelLabels.get(floor.plan.id)!,new THREE.Vector3(-.65,floor.group.position.y+.35,5.4),s.viewMode==='exploded'&&s.cameraMode!=='walk');
    const f=this.floor(),r=f.bounds;this.project(this.dimensionLabels[0],new THREE.Vector3((r.x1+r.x2)/2,f.elevation+.08,r.z2+.8),this.dimensions.visible);this.project(this.dimensionLabels[1],new THREE.Vector3(r.x2+.85,f.elevation+.08,(r.z1+r.z2)/2),this.dimensions.visible);
  }

  private resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(w<2||h<2)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer?.setSize(w,h);}

  private animate=(time:number)=>{
    if(this.disposed)return;this.frame=requestAnimationFrame(this.animate);if(document.hidden){this.lastTime=time;return;}const dt=Math.min((time-this.lastTime)/1000,.05);this.lastTime=time;
    for(const d of this.doors()){const target=d.open?1:0;d.progress=THREE.MathUtils.damp(d.progress,target,8,dt);d.pivot.rotation.y=THREE.MathUtils.lerp(d.closedAngle,d.openAngle,d.progress);}
    if(this.state.cameraMode==='walk'){this.updateDoorBoxes();this.move(dt);}else{if(this.transition){const t=THREE.MathUtils.clamp((time-this.transition.start)/this.transition.duration,0,1),a=ease(t);this.camera.position.lerpVectors(this.transition.from,this.transition.to,a);this.controls.target.lerpVectors(this.transition.fromTarget,this.transition.target,a);if(t>=1)this.transition=null;}this.controls.update();}
    if(this.state.quality==='high'&&this.composer)this.composer.render();else this.renderer.render(this.scene,this.camera);
    this.updateLabels();this.frames++;
    if(time-this.statsTime>450){const f=this.floor(),pos=this.camera.position,room=this.roomAt(pos.x,pos.z,f.id),near=Math.hypot(pos.x-(f.stair.x2+.3),pos.z-(f.stair.z2-.4))<2.2;
      const direction=this.camera.getWorldDirection(new THREE.Vector3());this.callbacks.onStats?.({fps:Math.round(this.frames*1000/(time-this.statsTime)),triangles:this.renderer.info.render.triangles,calls:this.renderer.info.render.calls,position:[pos.x,pos.z],heading:Math.atan2(direction.x,-direction.z),activeRoom:this.state.cameraMode==='walk'?(room?.id??null):null,nearDoor:this.state.cameraMode==='walk'?(this.nearestDoor()?.name??null):null,nearStair:this.state.cameraMode==='walk'&&near});this.frames=0;this.statsTime=time;
    }
  };

  async exportGLB(){
    this.callbacks.onNotice?.('正在整理五层建筑、家具与材质…');
    // Hosted releases include the verified, complete metre-scale model. This
    // avoids repeating a large texture/geometry export on slower computers.
    if(location.protocol==='https:'||location.protocol==='http:'){
      try{const response=await fetch('./downloads/yingcui-villa.glb');if(response.ok){const bytes=await response.arrayBuffer();if(bytes.byteLength>20&&new DataView(bytes).getUint32(0,true)===0x46546c67){this.download(new Blob([bytes],{type:'model/gltf-binary'}),'yingcui-villa.glb');this.callbacks.onNotice?.(`完整模型已导出 · ${(bytes.byteLength/1024/1024).toFixed(1)} MB`);return;}}}catch{/* Offline/source builds retain the full client exporter below. */}
    }
    const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
    const copy=this.building.root.clone(true);copy.children.forEach((obj,i)=>{if(this.building.floors[i])obj.position.y=this.building.floors[i].plan.elevation;});
    copy.traverse(o=>{o.visible=true;o.userData={...o.userData};});copy.updateMatrixWorld(true);
    const exporter=new GLTFExporter();
    const result=await exporter.parseAsync(copy,{binary:true,onlyVisible:true,maxTextureSize:1024});
    if(!(result instanceof ArrayBuffer))throw new Error('GLB 导出未产生二进制模型');
    this.download(new Blob([result],{type:'model/gltf-binary'}),'yingcui-villa.glb');this.callbacks.onNotice?.(`五层模型已导出 · ${(result.byteLength/1024/1024).toFixed(1)} MB`);
  }
  snapshot(){if(this.state.quality==='high'&&this.composer)this.composer.render();else this.renderer.render(this.scene,this.camera);this.renderer.domElement.toBlob(blob=>{if(blob){this.download(blob,'yingcui-view.png');this.callbacks.onNotice?.('当前三维视图已保存');}},'image/png');}
  private download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}

  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.cleanups.forEach(fn=>fn());if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();this.controls.dispose();this.composer?.dispose();this.scene.traverse(obj=>{if(obj instanceof THREE.Mesh||obj instanceof THREE.Line){obj.geometry.dispose();const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(m=>m.dispose());}});this.renderer.dispose();this.renderer.domElement.remove();this.labelLayer.remove();}
}
