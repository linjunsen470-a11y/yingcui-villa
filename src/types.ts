import type * as THREE from 'three';

export type FloorId = 'B1' | 'F1' | 'F2' | 'F3' | 'AT';
export type ViewMode = 'floor' | 'building' | 'exploded';
export type CameraMode = 'orbit' | 'walk' | 'plan';
export type RoomKind = 'living'|'dining'|'kitchen'|'bedroom'|'study'|'bathroom'|'wardrobe'|'gym'|'wine'|'leisure'|'multi'|'terrace'|'balcony'|'hall';
export interface Rect { x1:number; x2:number; z1:number; z2:number; }
export interface RoomDef extends Rect { id:string; name:string; floorId:FloorId; kind:RoomKind; description:string; spawn:[number,number]; look:[number,number]; color?:string; area?:number; }
export interface WallDef { id:string; a:[number,number]; b:[number,number]; thickness?:number; exterior?:boolean; height?:number; openings?:OpeningDef[]; }
export interface OpeningDef { id:string; offset:number; width:number; bottom:number; height:number; type:'door'|'window'|'passage'; name?:string; hinge?:'start'|'end'; swing?:number; }
export interface FloorPlan { id:FloorId; index:number; name:string; shortName:string; elevation:number; height:number; bounds:Rect; slabs:Rect[]; rooms:RoomDef[]; walls:WallDef[]; outdoor:Rect[]; stair:Rect; notes:string[]; }
export interface Collider { minX:number; maxX:number; minZ:number; maxZ:number; floorId:FloorId; kind:'wall'|'furniture'|'door'|'rail'; doorId?:string; }
export type Materials = Record<string,THREE.MeshStandardMaterial>;
export interface DoorRuntime { id:string; name:string; floorId:FloorId; pivot:THREE.Group; leaf:THREE.Mesh; closedAngle:number; openAngle:number; open:boolean; progress:number; collider:Collider; }
export interface FloorModel { plan:FloorPlan; group:THREE.Group; shell:THREE.Group; ceilings:THREE.Group; roof:THREE.Group; wallMeshes:THREE.Mesh[]; doors:DoorRuntime[]; colliders:Collider[]; }
export interface BuildingModel { root:THREE.Group; floors:FloorModel[]; }
export interface Furnishing { group:THREE.Group; colliders:Collider[]; }
export interface ViewerState { floorId:FloorId; viewMode:ViewMode; cameraMode:CameraMode; cutaway:boolean; labels:boolean; dimensions:boolean; lights:boolean; quality:'high'|'balanced'; selectedRoom:string|null; }
export interface ViewerStats { fps:number; triangles:number; calls:number; position:[number,number]; heading:number; activeRoom:string|null; nearDoor:string|null; nearStair:boolean; }
export interface CameraPreset { id:string; name:string; subtitle:string; floorId:FloorId; roomId:string; }
