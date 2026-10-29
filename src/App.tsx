import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, BedDouble, BookOpen, Building2, Camera, Check, ChevronDown, ChevronRight, CircleHelp, DoorOpen, Download, Dumbbell, Expand, Eye, Footprints, Grid2X2, Home, Image, Layers3, Leaf, Lightbulb, LoaderCircle, Maximize2, Moon, Move3D, PanelRightClose, PanelRightOpen, RotateCcw, Ruler, Scissors, Settings2, Sofa, Sparkles, Sun, Tags, UtensilsCrossed, Waves, Wine, X } from 'lucide-react';
import type { FloorId, FloorPlan, RoomDef, RoomKind, ViewerState, ViewerStats } from './types';
import { FLOORS, ROOMS } from './plans';
import { VillaViewer } from './viewer';
import './style.css';

const INITIAL: ViewerState = { floorId: 'F1', viewMode: 'floor', cameraMode: 'orbit', cutaway: true, labels: true, dimensions: false, lights: true, quality: 'balanced', selectedRoom: null };
const FLOOR_META: Record<FloorId, { code: string; title: string; subtitle: string; feeling: string; dimensions: string }> = {
  B1: { code: 'B1', title: '收藏生活的另一面', subtitle: '地下室', feeling: '运动、佳酿与相聚，让日常多一分从容。', dimensions: '6.0 × 10.4 m' },
  F1: { code: '01', title: '让生活，自然展开', subtitle: '首层', feeling: '客餐厅相连，向前一步，就是庭院与阳光。', dimensions: '6.0 × 10.4 m' },
  F2: { code: '02', title: '安放身心的私享之境', subtitle: '二层', feeling: '卧室、书房与衣帽间，为自己留一份安静。', dimensions: '6.0 × 12.0 m' },
  F3: { code: '03', title: '各有天地，温暖相依', subtitle: '三层', feeling: '双卧与家庭起居，让陪伴也拥有恰好的距离。', dimensions: '6.0 × 12.0 m' },
  AT: { code: 'RF', title: '把闲暇，交给天空', subtitle: '阁楼', feeling: '拾级而上，在屋顶起居与观景台遇见慢时光。', dimensions: '4.6 × 8.0 m' },
};
const PRESETS = [
  { roomId: 'F1-living', name: '客厅', icon: Sofa },
  { roomId: 'F1-dining', name: '餐厅', icon: UtensilsCrossed },
  { roomId: 'F2-master', name: '主卧', icon: BedDouble },
  { roomId: 'F2-study', name: '书房', icon: BookOpen },
  { roomId: 'B1-multi', name: '地下娱乐', icon: Wine },
  { roomId: 'F1-terrace', name: '观景露台', icon: Leaf },
];
const KIND_ICON: Partial<Record<RoomKind, typeof Home>> = { living: Sofa, dining: UtensilsCrossed, kitchen: UtensilsCrossed, bedroom: BedDouble, study: BookOpen, bathroom: Waves, wardrobe: Grid2X2, gym: Dumbbell, wine: Wine, leisure: Sofa, multi: Sparkles, terrace: Leaf, balcony: Leaf, hall: Footprints };
const KIND_NAME: Record<RoomKind, string> = { living: '起居会客', dining: '家庭餐叙', kitchen: '烹饪备餐', bedroom: '休息睡眠', study: '阅读办公', bathroom: '卫浴空间', wardrobe: '衣物收纳', gym: '健身运动', wine: '藏酒品鉴', leisure: '休闲交流', multi: '影音娱乐', terrace: '户外观景', balcony: '采光通风', hall: '交通过渡' };

function areaOf(room: RoomDef) { return (room.area ?? Math.max(0, room.x2 - room.x1 - .2) * Math.max(0, room.z2 - room.z1 - .2)).toFixed(1); }

function MiniPlan({ floor, selected, stats, onSelect, walking }: { floor: FloorPlan; selected: string | null; stats: ViewerStats | null; onSelect: (room: RoomDef) => void; walking: boolean }) {
  const allRects = [floor.bounds, ...floor.slabs, ...floor.outdoor];
  const minX = Math.min(...allRects.map(r => r.x1)) - .45;
  const maxX = Math.max(...allRects.map(r => r.x2)) + .45;
  const minZ = Math.min(...allRects.map(r => r.z1)) - .45;
  const maxZ = Math.max(...allRects.map(r => r.z2)) + .45;
  const scale = Math.min(112 / (maxX - minX), 158 / (maxZ - minZ));
  const offsetX = (132 - (maxX - minX) * scale) / 2;
  const offsetY = (166 - (maxZ - minZ) * scale) / 2;
  const px = (x: number) => (x - minX) * scale + offsetX;
  const pz = (z: number) => (z - minZ) * scale + offsetY;
  const inPlan = !!stats && stats.position[0] >= minX && stats.position[0] <= maxX && stats.position[1] >= minZ && stats.position[1] <= maxZ;
  return <svg className="mini-plan" viewBox="0 0 132 166" role="img" aria-label={`${floor.name}平面导航，点击房间查看`}>
    {floor.slabs.map((r, i) => <rect key={`s${i}`} x={px(r.x1)} y={pz(r.z1)} width={(r.x2 - r.x1) * scale} height={(r.z2 - r.z1) * scale} fill="#ede8df" stroke="#b9b2a5" strokeWidth=".6" />)}
    {floor.rooms.map(r => <g key={r.id} className="map-room" role="button" tabIndex={0} aria-label={`查看${r.name}`} onClick={() => onSelect(r)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(r); }}>
      <rect x={px(r.x1) + 1} y={pz(r.z1) + 1} width={Math.max(1, (r.x2 - r.x1) * scale - 2)} height={Math.max(1, (r.z2 - r.z1) * scale - 2)} fill={r.id === selected || (walking && r.id === stats?.activeRoom) ? '#638470' : r.kind === 'balcony' || r.kind === 'terrace' ? '#d9e2d0' : r.kind === 'bathroom' ? '#d8dedb' : '#e0d4bf'} />
      <title>{r.name} · 约 {areaOf(r)} ㎡</title>
    </g>)}
    {floor.walls.flatMap(w => {
      const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], length = Math.hypot(dx, dz);
      const openings = [...(w.openings ?? [])].sort((a, b) => a.offset - b.offset);
      const spans: [number, number][] = [];
      let start = 0;
      for (const o of openings) { if (o.offset > start) spans.push([start, o.offset]); start = o.offset + o.width; }
      if (start < length) spans.push([start, length]);
      return spans.map(([a, b], i) => <line key={`${w.id}-${i}`} x1={px(w.a[0] + dx * a / length)} y1={pz(w.a[1] + dz * a / length)} x2={px(w.a[0] + dx * b / length)} y2={pz(w.a[1] + dz * b / length)} stroke="#6e7064" strokeWidth={w.exterior ? 1.5 : 1} />);
    })}
    <rect x={px(floor.stair.x1)} y={pz(floor.stair.z1)} width={(floor.stair.x2 - floor.stair.x1) * scale} height={(floor.stair.z2 - floor.stair.z1) * scale} fill="#a3967d" opacity=".4" />
    {Array.from({ length: 9 }, (_, i) => <line key={`t${i}`} x1={px(floor.stair.x1 + .1)} y1={pz(floor.stair.z1 + (i + .5) * (floor.stair.z2 - floor.stair.z1) / 9)} x2={px(floor.stair.x2 - .1)} y2={pz(floor.stair.z1 + (i + .5) * (floor.stair.z2 - floor.stair.z1) / 9)} stroke="#9d8d74" strokeWidth=".6" />)}
    {inPlan && walking && <g transform={`translate(${px(stats!.position[0])},${pz(stats!.position[1])})`}>
      <circle r="7.5" fill="#2e5c4a" opacity=".13" />
      <g transform={`rotate(${stats!.heading * 180 / Math.PI})`}><path d="M0 -7 L-4.5 4 L0 2 L4.5 4 Z" fill="#244d3e" stroke="#fff" strokeWidth="1.1" /></g>
    </g>}
  </svg>;
}

function Modal({ kind, onClose }: { kind: 'plan' | 'notes' | 'help'; onClose: () => void }) {
  useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler); }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}><section className={`modal modal-${kind}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}>
    <div className="modal-heading"><div><span className="eyebrow">YINGCUI RESIDENCE</span><h2 id="modal-title">{kind === 'plan' ? '从原始图纸，到立体生活' : kind === 'notes' ? '模型依据与尺寸说明' : '像在家中一样，自由探索'}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭对话框"><X size={21} /></button></div>
    {kind === 'plan' ? <><div className="plan-image-wrap"><img src="./floorplan.jpg" alt="合盛盈翠雅筑原始户型图：地下室、首层、二层、三层、阁楼五个平面及标注尺寸" /></div><p className="modal-caption">上传原图是本模型的空间依据。前侧对应图纸下方；阁楼落位与立面根据连续楼梯关系推定。</p><a href="./floorplan.jpg" target="_blank" rel="noreferrer" className="text-link">单独打开原图 <Expand size={14} /></a></> : kind === 'notes' ? <div className="notes-content">
      <p className="notes-intro">五层结构按原图尺寸链建模，所有三维坐标统一使用米。清晰的图纸标注优先于插画比例；无法识别的部分采用保守推定。</p>
      <div className="note-highlight"><Ruler size={22} /><div><strong>尺寸有依据，推定有记录</strong><p>本成果用于空间浏览与设计沟通，面积为模型估算值，不替代施工图或测绘成果。</p></div></div>
      <h3>01 / 图纸可确认的尺寸</h3>
      <table><thead><tr><th>楼层</th><th>主体轴线尺寸</th><th>附属空间</th></tr></thead><tbody><tr><td>地下室 / 首层</td><td>6.0 × 10.4 m</td><td>首层前露台约 2.3 m、后露台约 1.6 m</td></tr><tr><td>二层 / 三层</td><td>6.0 × 12.0 m</td><td>前阳台深 1.5 m；后侧凸窗伸出 0.5 m</td></tr><tr><td>阁楼</td><td>4.6 × 8.0 m</td><td>纵向分段 2.7 + 3.3 + 2.0 m</td></tr></tbody></table>
      <h3>02 / 与文字描述的复核</h3>
      <p>原图明确标注三间卧室：二层一间、三层两间；另有书房和阁楼起居空间。模型保留这些空间用途。二层、三层各保留两处卫生间，三层还保留后左内凹阳台。</p>
      <h3>03 / 缺失数据的推定</h3>
      <dl className="assumption-grid"><div><dt>层高</dt><dd>地下室 3.00 m · 首层 3.35 m<br />二层 / 三层 3.10 m · 阁楼 2.80 m</dd></div><div><dt>构造</dt><dd>楼板约 0.20 m；墙厚、洞口高度、栏杆、窗框与屋面按住宅尺度推定。</dd></div><div><dt>阁楼落位</dt><dd>以楼梯上下连贯为优先，左侧对齐主体；其精确位置原图未标注。</dd></div><div><dt>楼梯与装修</dt><dd>楼梯级数、层间连接、立面及家具采用设计补全。家具和装修不作为原图尺寸依据。</dd></div></dl>
      <p className="fine-print">营销图所示建筑面积约 198–215 ㎡、使用面积约 238–255 ㎡采用不同统计口径；房间卡片仅提供可见模型空间的面积估值，不直接与上述数值相加比对。</p>
    </div> : <div className="help-content">
      <div className="help-feature"><Move3D /><div><h3>自由观察</h3><p>左键拖动旋转，右键拖动平移，滚轮拉近或拉远。点击房间查看信息，双击房间直接进入漫游。手机可拖动画面环顾。</p></div></div>
      <div className="help-feature"><Footprints /><div><h3>实景漫游</h3><p>点击「实景漫游」或房间的「进入空间」。鼠标转动视角，按以下按键移动；若未锁定鼠标，可按住画面拖动环顾。</p></div></div>
      <div className="key-guide"><div><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><label>前后左右行走</label></div><div><span><kbd>鼠标</kbd></span><label>360° 环顾</label></div><div><span><kbd>E</kbd></span><label>开 / 关附近的门</label></div><div><span><kbd>R</kbd><kbd>F</kbd></span><label>上层 / 下层导航</label></div><div><span><kbd>Shift</kbd></span><label>加快移动</label></div><div><span><kbd>Esc</kbd></span><label>释放鼠标或退出漫游</label></div></div>
      <div className="help-feature"><Layers3 /><div><h3>看见整栋住宅</h3><p>「完整建筑」查看外观；「楼层分离」展示五层结构；「单层剖切」打开一层。俯视平面自动隐藏上方遮挡，方便核对原图。</p></div></div>
      <div className="help-feature"><Download /><div><h3>继续你的设计</h3><p>「导出模型」下载 GLB 文件，可在 Blender 等三维软件中继续编辑。「保存画面」可下载当前视角。</p></div></div>
    </div>}
  </section></div>;
}

export default function App() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<VillaViewer | null>(null);
  const [state, setState] = useState<ViewerState>(INITIAL);
  const [stats, setStats] = useState<ViewerStats | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<'plan' | 'notes' | 'help' | null>(null);
  const [panel, setPanel] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState(false);
  const [mobileRooms, setMobileRooms] = useState(false);
  const patch = (next: Partial<ViewerState>) => setState(prev => ({ ...prev, ...next }));

  useEffect(() => {
    let disposed = false;
    const frame = requestAnimationFrame(() => {
      if (!canvasRef.current || disposed) return;
      try {
        viewer.current = new VillaViewer(canvasRef.current, {
          onStateChange: next => setState(prev => ({ ...prev, ...next })),
          onStats: next => setStats(next), onReady: () => setReady(true),
          onNotice: text => setNotice(text), onError: text => setError(text),
        });
        viewer.current.setState(INITIAL);
      } catch (err) { setError(err instanceof Error ? err.message : '三维场景暂时无法启动。'); }
    });
    return () => { disposed = true; cancelAnimationFrame(frame); viewer.current?.dispose(); viewer.current = null; };
  }, []);
  useEffect(() => { viewer.current?.setState(state); }, [state]);
  useEffect(() => { if (!notice) return; const timeout = window.setTimeout(() => setNotice(null), 4800); return () => window.clearTimeout(timeout); }, [notice]);

  const floor = FLOORS.find(f => f.id === state.floorId) ?? FLOORS[1];
  const meta = FLOOR_META[state.floorId];
  const walking = state.cameraMode === 'walk';
  const room = (walking ? ROOMS.find(r => r.id === stats?.activeRoom && r.floorId === state.floorId) : undefined) ?? ROOMS.find(r => r.id === state.selectedRoom);
  const rooms = floor.rooms.filter(r => r.kind !== 'hall');
  const changeFloor = (floorId: FloorId) => { patch({ floorId, viewMode: 'floor', selectedRoom: null, cameraMode: walking ? 'walk' : 'orbit' }); setMobileRooms(false); };
  const selectRoom = (r: RoomDef) => { patch({ selectedRoom: r.id }); setPanel(true); };
  const enterRoom = (r: RoomDef) => { viewer.current?.focusRoom(r.id, true); setMobileRooms(false); };
  const openModal = (kind: 'plan' | 'notes' | 'help') => { if (document.pointerLockElement) document.exitPointerLock(); setModal(kind); };
  const exportModel = async () => { if (!viewer.current || exporting) return; setExporting(true); setNotice('正在整理完整五层模型，请稍候…'); try { await viewer.current.exportGLB(); setNotice('GLB 模型已准备好，请查看浏览器下载。'); } catch (e) { setNotice(`导出未完成：${e instanceof Error ? e.message : '请重试'}`); } finally { setExporting(false); } };

  return <div className={`app ${walking ? 'is-walking' : ''} ${!panel ? 'panel-hidden' : ''}`}>
    <header className="site-header">
      <a className="brand" href="#" aria-label="盈翠雅筑，返回首层" onClick={e => { e.preventDefault(); patch(INITIAL); viewer.current?.resetCamera(); }}><span className="brand-mark"><Building2 size={25} strokeWidth={1.4} /><span /></span><span><strong>合盛 <i>·</i> 盈翠雅筑</strong><small>YINGCUI RESIDENCE</small></span></a>
      <div className="header-divider" /><div className="project-type"><span>联排别墅</span><small>五层空间 · 自由探索</small></div>
      <nav className="header-actions" aria-label="项目工具">{location.protocol !== 'file:' && <a className="source-download" href="./downloads/yingcui-villa-project.zip" download><Download size={15} /><span>下载项目</span><small>ZIP</small></a>}<button onClick={() => openModal('plan')}><Image size={16} /><span>原始图纸</span></button><button onClick={() => openModal('notes')}><BookOpen size={16} /><span>建模说明</span></button><button className="export-button" onClick={exportModel} disabled={exporting || !ready}>{exporting ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}<span>{exporting ? '正在导出' : '导出模型'}</span><small>GLB</small></button><button className="icon-button help-top" onClick={() => openModal('help')} aria-label="操作帮助"><CircleHelp size={19} /></button></nav>
    </header>

    <main className="experience" aria-label="三维住宅浏览器">
      <div className="canvas-host" ref={canvasRef} aria-label="可交互三维住宅场景" />
      <div className="canvas-vignette" />
      {!ready && !error && <div className="scene-loading"><span className="loading-building"><Building2 size={38} strokeWidth={1} /></span><span className="eyebrow">CRAFTING YOUR SPACE</span><h2>空间，正在展开</h2><p>正在构建五层住宅与室内细节</p><div className="loading-line"><span /></div></div>}
      {error && <div className="scene-error"><Building2 size={32} /><h2>暂时无法显示三维场景</h2><p>{error}</p><p className="fine-print">请使用支持 WebGL 2 的桌面浏览器，并开启硬件加速。</p><button className="primary-button" onClick={() => window.location.reload()}><RotateCcw size={16} />重新加载</button></div>}

      <div className="view-segments" role="group" aria-label="建筑展示模式">
        <button className={state.viewMode === 'building' ? 'active' : ''} onClick={() => patch({ viewMode: 'building', cameraMode: 'orbit' })}><Building2 size={16} /><span>完整建筑</span></button>
        <button className={state.viewMode === 'exploded' ? 'active' : ''} onClick={() => patch({ viewMode: 'exploded', cameraMode: 'orbit' })}><Layers3 size={16} /><span>楼层分离</span></button>
        <button className={state.viewMode === 'floor' ? 'active' : ''} onClick={() => patch({ viewMode: 'floor', cameraMode: 'orbit', cutaway: true })}><Scissors size={16} /><span>单层剖切</span></button>
      </div>

      <section className="scene-title"><div className="eyebrow"><span className="title-line" /> SPACE FOR LIVING</div><h1>{state.viewMode === 'building' ? '一栋住宅，五重生活' : state.viewMode === 'exploded' ? '生活的层次，一目了然' : meta.title}</h1><p>{state.viewMode === 'building' ? '从整栋建筑出发，探索每一个属于生活的角落。' : state.viewMode === 'exploded' ? '让五层空间徐徐展开，读懂上下之间的联系。' : meta.feeling}</p><div className="scene-tags"><span><span className="live-dot" /> 实时三维</span><span>真实比例 · 米制</span></div></section>

      <nav className="floor-dock" aria-label="选择楼层"><span className="dock-label">FLOORS</span>{[...FLOORS].reverse().map(f => <button key={f.id} className={`floor-button ${state.floorId === f.id ? 'active' : ''}`} onClick={() => changeFloor(f.id)} aria-label={`切换到${f.name}`} aria-pressed={state.floorId === f.id}><b>{f.id === 'AT' ? 'RF' : f.id === 'F1' ? '1F' : f.id === 'F2' ? '2F' : f.id === 'F3' ? '3F' : 'B1'}</b><span>{f.name}</span><i /></button>)}<span className="dock-end">5 LEVELS</span></nav>

      <button className="panel-toggle icon-button" onClick={() => setPanel(!panel)} aria-label={panel ? '收起空间信息' : '展开空间信息'}>{panel ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}</button>
      <button className="mobile-room-toggle" onClick={() => setMobileRooms(!mobileRooms)}><Home size={16} />{floor.name}空间<ChevronDown size={15} /></button>

      <aside className={`space-panel ${panel ? '' : 'is-hidden'} ${mobileRooms ? 'mobile-open' : ''}`} aria-label="楼层与房间信息">
        <div className="panel-heading"><span className="eyebrow">EXPLORE THE SPACE</span><span className="floor-badge">{meta.code}</span></div>
        <div className="floor-summary"><h2>{floor.name}<span>{state.floorId === 'B1' ? '娱乐与休闲' : state.floorId === 'F1' ? '日常与相聚' : state.floorId === 'F2' ? '私享与静谧' : state.floorId === 'F3' ? '家人与陪伴' : '天空与闲暇'}</span></h2><div className="floor-measures"><span><Ruler size={12} />{meta.dimensions}</span><span>标高 {floor.elevation > 0 ? '+' : ''}{floor.elevation.toFixed(2)} m</span></div></div>
        {room && <div className="selected-room-card"><div className="room-card-heading"><span className="room-category">{KIND_NAME[room.kind]}</span><button className="clear-room" aria-label="取消房间选择" onClick={() => patch({ selectedRoom: null })}><X size={13} /></button></div><h3>{room.name}<span>约 <b>{areaOf(room)}</b> ㎡</span></h3><p>{room.description}</p><div className="room-card-actions"><button className="primary-button" onClick={() => enterRoom(room)}><Footprints size={15} />进入空间<ArrowRight size={15} /></button><button className="look-room" aria-label={`观察${room.name}`} title="从外部观察" onClick={() => viewer.current?.focusRoom(room.id, false)}><Eye size={16} /></button></div></div>}
        <div className="room-list-heading"><span>本层空间</span><small>{rooms.length} SPACES</small></div>
        <div className="room-list">{rooms.map(r => { const Icon = KIND_ICON[r.kind] ?? Home; const chosen = r.id === room?.id; return <button className={`room-row ${chosen ? 'selected' : ''}`} key={r.id} onClick={() => selectRoom(r)}><span className="room-icon"><Icon size={15} strokeWidth={1.6} /></span><span className="room-name">{r.name}</span><small>{areaOf(r)}<em>㎡</em></small><ChevronRight size={13} /></button>; })}</div>
        <div className="map-section"><div className="map-heading"><span><Grid2X2 size={12} />平面导航</span><small>点击房间查看</small></div><div className="map-content"><MiniPlan floor={floor} selected={room?.id ?? null} stats={stats} onSelect={selectRoom} walking={walking} /><div className="map-legend"><span><i className="legend-interior" />室内空间</span><span><i className="legend-outdoor" />露台 / 阳台</span><span><i className="legend-selected" />当前空间</span><div className="map-direction"><ArrowUp size={16} /><small>图纸后侧</small></div></div></div></div>
        <p className="area-note">房间面积为扣墙后的模型估值</p>
      </aside>

      {!walking && <div className="camera-presets"><span className="presets-label">即刻抵达</span>{PRESETS.map(p => { const Icon = p.icon; return <button key={p.roomId} className={state.selectedRoom === p.roomId ? 'active' : ''} onClick={() => viewer.current?.focusRoom(p.roomId, true)} title={`进入${p.name}`}><Icon size={14} /><span>{p.name}</span></button>; })}</div>}

      {walking && <><div className="walk-crosshair" /><div className="walk-location"><span className="live-dot" />{floor.name}<ChevronRight size={13} />{room?.name ?? '自由漫游'}<span className="walk-eye">视高 1.64 m</span></div><div className="walk-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 行走</span><span>鼠标 / 拖动 环顾</span><span><kbd>E</kbd> 开门</span><span><kbd>Esc</kbd> 释放鼠标</span></div><div className="walk-actions"><button disabled={!stats?.nearDoor} onClick={() => viewer.current?.toggleDoor()}><DoorOpen size={16} />{stats?.nearDoor ? '开 / 关门' : '靠近门可交互'}</button><button disabled={state.floorId === 'AT'} onClick={() => viewer.current?.changeFloor(1)}><ArrowUp size={16} />上一层</button><button disabled={state.floorId === 'B1'} onClick={() => viewer.current?.changeFloor(-1)}><ArrowDown size={16} />下一层</button></div></>}

      <div className="bottom-controls"><div className="camera-control-group" role="group" aria-label="相机模式"><button className={state.cameraMode === 'orbit' ? 'active' : ''} onClick={() => { if (walking) viewer.current?.stopWalk(); patch({ cameraMode: 'orbit' }); }}><Move3D size={17} /><span>自由观察</span></button><button className={state.cameraMode === 'plan' ? 'active' : ''} onClick={() => patch({ cameraMode: 'plan', viewMode: 'floor', cutaway: true })}><Grid2X2 size={17} /><span>俯视平面</span></button><button className={`walk-button ${walking ? 'active' : ''}`} onClick={() => walking ? viewer.current?.stopWalk() : viewer.current?.startWalk()}><Footprints size={17} /><span>{walking ? '结束漫游' : '实景漫游'}</span></button></div><div className="control-divider" /><div className="utility-controls"><button className={state.cutaway ? 'is-on' : ''} onClick={() => patch({ cutaway: !state.cutaway })} title={state.cutaway ? '恢复完整墙体' : '降低墙体，查看内部'} aria-label="切换墙体剖切" aria-pressed={state.cutaway}><Scissors size={17} /></button><button className={state.labels ? 'is-on' : ''} onClick={() => patch({ labels: !state.labels })} title="空间名称" aria-label="切换房间名称" aria-pressed={state.labels}><Tags size={17} /></button><button className={state.dimensions ? 'is-on' : ''} onClick={() => patch({ dimensions: !state.dimensions })} title="尺寸标注" aria-label="切换尺寸标注" aria-pressed={state.dimensions}><Ruler size={17} /></button><button onClick={() => patch({ lights: !state.lights })} title={state.lights ? '切换夜景暖光' : '切换日景自然光'} aria-label={state.lights ? '切换夜景暖光' : '切换日景自然光'}>{state.lights ? <Sun size={17} /> : <Moon size={17} />}</button><button onClick={() => viewer.current?.resetCamera()} title="重置视角" aria-label="重置视角"><RotateCcw size={17} /></button><button className={settings ? 'is-on' : ''} onClick={() => setSettings(!settings)} title="更多选项" aria-label="更多选项"><Settings2 size={17} /></button></div>
        {settings && <div className="settings-popover"><div className="settings-title">显示与导出</div><div className="quality-row"><span>画质</span><button className={state.quality === 'balanced' ? 'chosen' : ''} onClick={() => patch({ quality: 'balanced' })}>流畅</button><button className={state.quality === 'high' ? 'chosen' : ''} onClick={() => patch({ quality: 'high' })}>精细</button></div><button onClick={() => { viewer.current?.snapshot(); setSettings(false); }}><Camera size={16} />保存当前画面<Download size={13} /></button><button onClick={() => { openModal('help'); setSettings(false); }}><CircleHelp size={16} />查看操作帮助<ArrowRight size={13} /></button></div>}
      </div>

      <div className="scene-footer"><span><span className="status-dot" />{ready ? '模型已就绪' : '模型构建中'}<i />1 单位 = 1 米</span><button onClick={() => openModal('notes')}>基于原始户型图 · 含推定尺寸 <ChevronRight size={11} /></button><span className="performance">{ready && stats ? `${Math.round(stats.fps)} FPS` : 'WEBGL'}<i />{state.quality === 'high' ? '精细画质' : '流畅画质'}</span></div>
      {notice && <div className="toast" role="status"><Check size={16} /><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="关闭提示"><X size={14} /></button></div>}
    </main>
    {modal && <Modal kind={modal} onClose={() => setModal(null)} />}
  </div>;
}
