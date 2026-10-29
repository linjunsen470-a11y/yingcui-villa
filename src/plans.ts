import type { FloorId, FloorPlan, OpeningDef, Rect, RoomDef, RoomKind, WallDef } from './types';

// All dimensions are metres. x: left→right; z: back→front of the source plan.
// The rear wall of F1 is z=0. Upper floors project 1.60 m to the rear.
const room = (floorId:FloorId,id:string,name:string,kind:RoomKind,r:Rect,spawn:[number,number],look:[number,number],description:string):RoomDef => ({
  floorId,id:`${floorId}-${id}`,name,kind,...r,spawn,look,description,
  area:Math.round(Math.max(0,r.x2-r.x1-.2)*Math.max(0,r.z2-r.z1-.2)*10)/10,
});
const rect=(x1:number,x2:number,z1:number,z2:number):Rect=>({x1,x2,z1,z2});
const door=(id:string,offset:number,width=.9,name='房门',swing=1,hinge:'start'|'end'='start'):OpeningDef=>({id,offset,width,bottom:0,height:2.18,type:'door',name,swing,hinge});
const win=(id:string,offset:number,width:number,bottom=.8,height=1.55):OpeningDef=>({id,offset,width,bottom,height,type:'window'});
const passage=(id:string,offset:number,width:number):OpeningDef=>({id,offset,width,bottom:0,height:2.65,type:'passage'});
const wall=(id:string,a:[number,number],b:[number,number],openings:OpeningDef[]=[],exterior=false,height?:number):WallDef=>({id,a,b,openings,exterior,height,thickness:exterior?.22:.13});

const b1rooms:RoomDef[]=[
  room('B1','gym','健身房','gym',rect(0,3,0,2.2),[2.3,1.7],[.65,.7],'原图后左侧健身房，设置力量与有氧训练器械。'),
  room('B1','wine','酒窖','wine',rect(3,6,0,2.2),[3.8,1.65],[5.2,.6],'原图后右侧独立酒窖，木质酒架与品酒陈列。'),
  room('B1','leisure','休闲区','leisure',rect(1.9,6,2.2,5.6),[2.6,4.8],[4.9,3.65],'楼梯右侧的过渡休闲区域，连接健身房、酒窖与多功能厅。'),
  room('B1','multi','多功能厅','multi',rect(0,6,5.6,10.4),[3,6.45],[4.7,8.15],'原图前部开敞多功能厅，右侧影音沙发与左侧投影屏幕。'),
];
const f1rooms:RoomDef[]=[
  room('F1','bath','客用卫生间','bathroom',rect(0,1.9,0,3),[1.3,2.4],[.65,.8],'原图后左卫生间，长度按像素比例估计约3.0米。'),
  room('F1','kitchen','厨房','kitchen',rect(1.9,6,0,2.2),[3.5,1.55],[2.2,.45],'后侧开放厨房，后门通往小露台，保留餐厨开放关系。'),
  room('F1','dining','餐厅','dining',rect(1.9,6,2.2,5.6),[2.45,4.9],[4.25,3.55],'中央餐厅与客厅相通，圆形餐桌按可用空间控制尺寸。'),
  room('F1','living','客厅','living',rect(0,6,5.6,10.4),[3.7,9.45],[1.5,7.5],'原图前部客厅，沙发靠左、影音墙靠右，双开门通往观景露台。'),
  room('F1','terrace','观景露台','terrace',rect(0,6,10.4,12.7),[3.8,11.4],[1.5,11.5],'前侧全宽露台；原图净深2.0米，另有0.3米围边。'),
  room('F1','rear','后露台','terrace',rect(3,6,-1.6,0),[5.05,-.75],[3.6,-.8],'厨房外的后侧露台；原图1.3米净深加0.3米围边。'),
];
const f2rooms:RoomDef[]=[
  room('F2','bath-rear','书房卫生间','bathroom',rect(0,1.9,-1.6,2.2),[1.15,1.55],[.8,-.7],'保留原图后左整段卫生间，由书房一侧进入。'),
  room('F2','study','书房','study',rect(1.9,6,-1.6,2.2),[2.45,1.45],[4.4,-.1],'后部独立书房，后侧窄凸窗、右侧整面书架。'),
  room('F2','hall','楼梯厅','hall',rect(1.9,3,2.2,5.6),[2.45,4.9],[2.45,2.5],'1.1米轴线宽走道，联系楼梯、书房及主卧。'),
  room('F2','wardrobe','主卧衣帽间','wardrobe',rect(3,6,2.2,5.6),[4,5.05],[4.6,3.2],'原图中部右侧步入式衣帽间，与主卧开放连接。'),
  room('F2','bath-front','主卧卫生间','bathroom',rect(0,1.9,5.6,10.4),[1.1,6.4],[.9,9],'保留原图前左独立主卫，双台盆、坐便器与浴缸。'),
  room('F2','master','主卧室','bedroom',rect(1.9,6,5.6,10.4),[2.55,6.45],[4.8,8.5],'前部主卧套房，面向独立前阳台，床按1.8×2.0米布置。'),
  room('F2','balcony','主卧阳台','balcony',rect(3,6,10.4,11.9),[3.6,11.05],[5,11.05],'原图3.0×1.5米前侧阳台，玻璃栏杆与绿植围边。'),
];
const f3rooms:RoomDef[]=[
  room('F3','balcony-rear','后侧内凹阳台','balcony',rect(0,1.9,-1.6,0),[1.1,-.8],[.5,-1.25],'原图后卧左侧内凹阳台，1.9×1.6米轴线范围。'),
  room('F3','bath-rear','后卧卫生间','bathroom',rect(0,1.9,0,2.2),[1.1,1.55],[.6,.55],'后卧侧卫生间，保留与后侧阳台的相邻关系。'),
  room('F3','bedroom-rear','后卧室','bedroom',rect(1.9,6,-1.6,2.2),[2.5,1.45],[4.8,-.3],'三层后卧室，独立卫生间及内凹阳台。'),
  room('F3','living','家庭起居室','living',rect(1.9,6,2.2,5.6),[2.5,4.8],[4.7,3.7],'中部家庭起居室，右侧转角沙发，联系前后卧室。'),
  room('F3','wardrobe','前卧衣帽间','wardrobe',rect(0,1.9,5.6,7.85),[1.1,6.2],[.55,7.15],'前左衣帽间，从起居室进入，并连接前卧卫生间。'),
  room('F3','bath-front','前卧卫生间','bathroom',rect(0,1.9,7.85,10.4),[1.1,8.4],[.75,9.7],'前卧套房的卫生间，纵向分界按原图比例估算。'),
  room('F3','bedroom-front','前卧室','bedroom',rect(1.9,6,5.6,10.4),[2.5,6.45],[4.8,8.5],'三层前卧室，右侧床位、前侧外挑阳台。'),
  room('F3','balcony','前卧阳台','balcony',rect(3,6,10.4,11.9),[3.6,11.05],[5,11.05],'原图3.0×1.5米前阳台。'),
];
const atrooms:RoomDef[]=[
  room('AT','lounge','阁楼休闲区','leisure',rect(0,4.6,-.5,2.2),[1.55,1.55],[3.3,.5],'阁楼后部家庭休闲空间；阁楼整体落位依据楼梯对齐推定。'),
  room('AT','hall','阁楼起居空间','hall',rect(1.9,4.6,2.2,5.5),[2.6,4.8],[3.65,3.1],'楼梯右侧的开放起居与阅读空间。'),
  room('AT','terrace','阁楼观景台','terrace',rect(0,4.6,5.5,7.5),[2.6,6.5],[.9,6.4],'阁楼前侧2.0米深观景台，以保守的开放露台建模。'),
];

function upperExternal(id:FloorId):WallDef[]{
  return [
    wall(`${id}-back`,[0,-1.6],[6,-1.6],[win(`${id}-back-left`,.3,1.2,.9,1.55),win(`${id}-back-main`,3.2,2.5,.55,1.95)],true),
    wall(`${id}-left`,[0,-1.6],[0,10.4],[win(`${id}-left-back`,.65,1.35,1.15,1.2),win(`${id}-left-front`,8.5,2.7,1.15,1.2)],true),
    wall(`${id}-right`,[6,-1.6],[6,10.4],[win(`${id}-right-back`,.6,2.6,.65,1.85),win(`${id}-right-mid`,4.2,2.6,.65,1.85),win(`${id}-right-front`,8.1,2.9,.65,1.85)],true),
    wall(`${id}-front`,[0,10.4],[6,10.4],[win(`${id}-front-bath`,.3,1.2,1.15,1.2),door(`${id}-balcony-door`,3.25,2.3,'阳台玻璃门',-1)],true),
  ];
}

export const FLOORS:FloorPlan[]=[
  {id:'B1',index:0,name:'地下室',shortName:'B1',elevation:-3,height:3,bounds:rect(0,6,0,10.4),slabs:[rect(0,6,0,10.4)],rooms:b1rooms,outdoor:[],stair:rect(.16,1.84,3.85,5.6),notes:['外轮廓6.0×10.4米。','健身房与酒窖分墙按插画比例约居中；局部尺寸链不完全吻合。'],walls:[
    wall('B1-back',[0,0],[6,0],[win('B1-gym-window',.45,2.0,1.85,.65)],true),
    wall('B1-left',[0,0],[0,10.4],[win('B1-left-window',6.4,2.7,1.85,.65)],true),
    wall('B1-right',[6,0],[6,10.4],[win('B1-right-lounge',2.7,2.2,1.75,.75),win('B1-right-multi',6.2,3.1,1.75,.75)],true),
    wall('B1-front',[0,10.4],[6,10.4],[],true),
    wall('B1-gym-wine',[3,0],[3,2.2]),
    wall('B1-rear-partition',[0,2.2],[6,2.2],[door('B1-gym-door',1.95,.9,'健身房门'),door('B1-wine-door',3.5,.9,'酒窖门',1)]),
    wall('B1-multi-partition',[0,5.6],[6,5.6],[passage('B1-multi-opening',3.8,1.85)]),
  ]},
  {id:'F1',index:1,name:'首层',shortName:'01',elevation:0,height:3.35,bounds:rect(0,6,-1.6,12.7),slabs:[rect(0,6,0,10.4),rect(3,6,-1.6,0),rect(0,6,10.4,12.7)],rooms:f1rooms,outdoor:[rect(3,6,-1.6,0),rect(0,6,10.4,12.7)],stair:rect(.16,1.84,3.85,5.6),notes:['主体6.0×10.4米。','前露台净深2.0米加0.3米围边；后露台净深1.3米加0.3米围边。','首层卫生间深度按图像比例约3.0米。'],walls:[
    wall('F1-back',[0,0],[6,0],[win('F1-bath-window',.3,1.2,1.6,1.05),win('F1-kitchen-window',2.5,1.5,1.2,1.45),door('F1-back-door',4.55,1.15,'厨房后门',-1)],true),
    wall('F1-left',[0,0],[0,10.4],[win('F1-left-living',6.05,3.65,.5,2.25)],true),
    wall('F1-right',[6,0],[6,10.4],[win('F1-kitchen-side',.4,1.45,1.15,1.5),win('F1-dining-side',2.65,2.2,.55,2.2),win('F1-living-side',6.05,3.65,.5,2.25)],true),
    wall('F1-front',[0,10.4],[6,10.4],[win('F1-front-window',.3,2.5,.5,2.2),door('F1-entry',3.15,1.6,'客厅入户双门',1)],true),
    wall('F1-bath-east',[1.9,0],[1.9,3]),
    wall('F1-bath-south',[0,3],[1.9,3],[door('F1-bath-door',.9,.9,'客用卫生间门',1)]),
    wall('F1-kitchen-divider',[1.9,2.2],[6,2.2],[passage('F1-kitchen-opening',.75,3.25)]),
  ]},
  {id:'F2',index:2,name:'二层',shortName:'02',elevation:3.35,height:3.1,bounds:rect(0,6,-2.1,11.9),slabs:[rect(0,6,-1.6,10.4),rect(3,6,-2.1,-1.6),rect(3,6,10.4,11.9)],rooms:f2rooms,outdoor:[rect(3,6,10.4,11.9)],stair:rect(.16,1.84,2.2,5.6),notes:['主体6.0×12.0米，向后比首层多出1.6米。','原图为书房、主卧与两间卫生间。'],walls:[
    ...upperExternal('F2'),
    wall('F2-rear-bath-east',[1.9,-1.6],[1.9,2.2],[door('F2-rear-bath-door',2.75,.9,'书房卫生间门',-1)]),
    wall('F2-rear-divider',[0,2.2],[6,2.2],[door('F2-study-door',1.95,1,'书房门',1,'end')]),
    wall('F2-wardrobe-west',[3,2.2],[3,5.6]),
    wall('F2-front-divider',[0,5.6],[6,5.6],[door('F2-master-door',1.95,1,'主卧门',-1,'end'),passage('F2-wardrobe-opening',3.2,1.2)]),
    wall('F2-front-bath-east',[1.9,5.6],[1.9,10.4],[door('F2-front-bath-door',.3,.9,'主卧卫生间门',-1)]),
  ]},
  {id:'F3',index:3,name:'三层',shortName:'03',elevation:6.45,height:3.1,bounds:rect(0,6,-2.1,11.9),slabs:[rect(0,6,-1.6,10.4),rect(3,6,-2.1,-1.6),rect(3,6,10.4,11.9)],rooms:f3rooms,outdoor:[rect(0,1.9,-1.6,0),rect(3,6,10.4,11.9)],stair:rect(.16,1.84,2.2,5.6),notes:['两间卧室、家庭起居室、衣帽间、两卫、前后两处阳台。','前左衣帽间与卫生间分界按原图比例估算。'],walls:[
    ...upperExternal('F3').filter(w=>w.id!=='F3-back'&&w.id!=='F3-left'),
    wall('F3-back',[1.9,-1.6],[6,-1.6],[win('F3-back-main',1.3,2.5,.55,1.95)],true),
    wall('F3-left',[0,0],[0,10.4],[win('F3-left-bath',.35,1.4,1.2,1.15),win('F3-left-front',8.25,1.8,1.2,1.15)],true),
    wall('F3-rear-west',[1.9,-1.6],[1.9,2.2],[door('F3-rear-balcony-door',.35,.95,'后阳台门',-1),door('F3-rear-bath-door',2.7,.9,'后卧卫生间门',-1)]),
    wall('F3-rear-bath-north',[0,0],[1.9,0],[win('F3-bath-north-window',.25,1.35,1.2,1.15)]),
    wall('F3-rear-divider',[0,2.2],[6,2.2],[door('F3-rear-bedroom-door',1.95,1,'后卧室门',1,'end')]),
    wall('F3-front-divider',[0,5.6],[6,5.6],[door('F3-wardrobe-door',.85,.95,'前卧衣帽间门',-1),door('F3-front-bedroom-door',1.95,1,'前卧室门',-1,'end')]),
    wall('F3-front-suite-west',[1.9,5.6],[1.9,10.4]),
    wall('F3-front-bath-north',[0,7.85],[1.9,7.85],[door('F3-front-bath-door',.85,.95,'前卧卫生间门',-1)]),
  ]},
  {id:'AT',index:4,name:'阁楼',shortName:'AT',elevation:9.55,height:2.8,bounds:rect(0,4.6,-.5,7.5),slabs:[rect(0,4.6,-.5,7.5)],rooms:atrooms,outdoor:[rect(0,4.6,5.5,7.5)],stair:rect(.16,1.84,2.2,5.5),notes:['4.6×8.0米为图纸标注，阁楼在屋面上的具体位置属于推定。','后部2.7米、中央3.3米、观景台2.0米；保持左侧楼梯竖向对齐。'],walls:[
    wall('AT-back',[0,-.5],[4.6,-.5],[win('AT-back-window',.35,3.9,.5,1.75)],true),
    wall('AT-left',[0,-.5],[0,5.5],[win('AT-left-window',.45,1.8,.6,1.65)],true),
    wall('AT-right',[4.6,-.5],[4.6,5.5],[win('AT-right-window',.5,4.8,.6,1.65)],true),
    wall('AT-terrace-front',[0,5.5],[4.6,5.5],[door('AT-terrace-door',2.1,1.7,'阁楼观景台门',1)],true),
  ]},
];

export const ROOMS:RoomDef[]=FLOORS.flatMap(f=>f.rooms);
export const getFloor=(id:FloorId):FloorPlan=>FLOORS.find(f=>f.id===id)!;
export const getRoom=(id:string):RoomDef|undefined=>ROOMS.find(r=>r.id===id);
