import * as THREE from 'three';
import type { Materials } from './types';

// Seeded, locally generated PBR texture maps. No remote texture service is needed.
function random(seed:number) { let a=seed; return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}; }
function canvas(size=512){const c=document.createElement('canvas');c.width=c.height=size;return c;}
function tex(c:HTMLCanvasElement,repeatX=1,repeatY=1,color=true){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=8;return t;}

function woodTexture(dark=false,planks=true){
  const c=canvas(1024),ctx=c.getContext('2d')!,rand=random(47);const board=128;
  ctx.fillStyle=dark?'#69503c':'#c9aa7c';ctx.fillRect(0,0,1024,1024);
  for(let b=0;b<8;b++){
    const offset=rand()*200;
    ctx.fillStyle=`rgba(${dark?'180,140,97':'246,213,160'},${rand()*.15+.03})`;ctx.fillRect(b*board,0,board,1024);
    for(let n=0;n<165;n++){
      const x=b*board+rand()*board;
      ctx.strokeStyle=`rgba(${n%3?'71,47,26':'255,235,195'},${rand()*.16+.02})`;ctx.lineWidth=.25+rand()*1.5;
      ctx.beginPath();
      for(let y=0;y<=1024;y+=16){const xx=x+Math.sin(y*.009+offset)*2.6+Math.sin(y*.021+x)*.6; y?ctx.lineTo(xx,y):ctx.moveTo(xx,y);}
      ctx.stroke();
    }
    if(planks){
      ctx.fillStyle='rgba(50,35,20,.34)';ctx.fillRect(b*board,0,1.5,1024);
      const join=128+Math.floor(rand()*5)*128;ctx.fillRect(b*board,join,board,1.7);
      ctx.fillStyle='rgba(255,239,207,.3)';ctx.fillRect(b*board+2,0,1,1024);
    }
  }
  return c;
}
function stoneTexture(tile=false){
  const c=canvas(512),ctx=c.getContext('2d')!,rand=random(89);ctx.fillStyle=tile?'#ded7c9':'#e8e4dc';ctx.fillRect(0,0,512,512);
  const d=ctx.getImageData(0,0,512,512);for(let i=0;i<d.data.length;i+=4){let n=(rand()-.5)*10;d.data[i]+=n;d.data[i+1]+=n;d.data[i+2]+=n;}ctx.putImageData(d,0,0);
  for(let v=0;v<12;v++){
    let x=rand()*700-100,y=rand()*512;ctx.beginPath();ctx.moveTo(x,y);
    for(let k=0;k<20;k++){x+=10+rand()*28;y+=(rand()-.45)*35;ctx.lineTo(x,y);}
    ctx.strokeStyle=`rgba(125,116,99,${v<4?.14:.055})`;ctx.lineWidth=v<4?.8:2.5;ctx.stroke();
  }
  if(tile){ctx.strokeStyle='rgba(151,140,122,.6)';ctx.lineWidth=2;ctx.strokeRect(0,0,256,256);ctx.strokeRect(256,0,256,256);ctx.strokeRect(0,256,256,256);ctx.strokeRect(256,256,256,256);}
  return c;
}
function fabricTexture(){
  const c=canvas(256),ctx=c.getContext('2d')!,rand=random(18);ctx.fillStyle='#e1ddd4';ctx.fillRect(0,0,256,256);
  for(let i=0;i<256;i+=2){ctx.strokeStyle=`rgba(75,66,52,${.03+rand()*.09})`;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.stroke();ctx.strokeStyle=`rgba(255,255,255,${.1+rand()*.17})`;ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}return c;
}
function noiseTexture(){const c=canvas(128),ctx=c.getContext('2d')!,rand=random(16),data=ctx.createImageData(128,128);for(let i=0;i<data.data.length;i+=4){const p=155+rand()*70;data.data[i]=data.data[i+1]=data.data[i+2]=p;data.data[i+3]=255;}ctx.putImageData(data,0,0);return c;}

export function createMaterials():Materials{
  const wood=woodTexture(),oak=woodTexture(false,false),dark=woodTexture(true,false),stone=stoneTexture(),tiles=stoneTexture(true),fabric=fabricTexture();
  const n=tex(noiseTexture(),4,4,false), f=tex(fabric,3,3),fb=tex(fabric,3,3,false);
  const standard=(color:string,roughness=.65,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const m:Materials={
    wall:standard('#eee9dc',.84), exterior:standard('#e3ddcc',.88), concrete:standard('#bab6a8',.92),
    wood:new THREE.MeshStandardMaterial({map:tex(wood,.65,.36),bumpMap:tex(wood,.65,.36,false),bumpScale:.012,roughness:.53,roughnessMap:n}),
    oak:new THREE.MeshStandardMaterial({map:tex(oak),bumpMap:tex(oak,1,1,false),bumpScale:.007,roughness:.4}),
    woodDark:new THREE.MeshStandardMaterial({map:tex(dark),color:'#c2ab92',bumpMap:tex(dark,1,1,false),bumpScale:.008,roughness:.44}),
    stone:new THREE.MeshStandardMaterial({map:tex(stone),roughness:.27,metalness:.04}),
    tile:new THREE.MeshStandardMaterial({map:tex(tiles,2,3),bumpMap:tex(tiles,2,3,false),bumpScale:.008,roughness:.4}),
    brass:standard('#b19964',.29,.77), metal:standard('#323c35',.38,.7),
    glass:new THREE.MeshPhysicalMaterial({color:'#cbdad5',transparent:true,opacity:.22,roughness:.08,metalness:.13,depthWrite:false,side:THREE.DoubleSide}),
    linen:new THREE.MeshStandardMaterial({color:'#f0e8dc',map:f,bumpMap:fb,bumpScale:.017,roughness:.91}),
    cream:new THREE.MeshStandardMaterial({color:'#f1e9d9',map:f,bumpMap:fb,bumpScale:.014,roughness:.85}),
    green:new THREE.MeshStandardMaterial({color:'#56624c',bumpMap:fb,bumpScale:.012,roughness:.8}),
    leather:new THREE.MeshStandardMaterial({color:'#976f4c',roughness:.59,bumpMap:n,bumpScale:.004}),
    white:standard('#f6f2e9',.24),black:standard('#19231f',.36,.1),
    light:new THREE.MeshStandardMaterial({color:'#fff0c8',emissive:'#ffd48b',emissiveIntensity:2.2,roughness:.35}),
    water:new THREE.MeshPhysicalMaterial({color:'#9ebfb7',transparent:true,opacity:.6,roughness:.1,metalness:.1}),
    carpet:new THREE.MeshStandardMaterial({color:'#b5afa1',map:f,bumpMap:fb,bumpScale:.028,roughness:1})
  };
  Object.entries(m).forEach(([k,v])=>v.name=k);
  return m;
}
