/**
 * Build official-mechanism version cards for every hero + key maps, then merge into knowledge-sources.json.
 * Ability blurbs follow Blizzard kit wording (CN); numbers are illustrative of current-live kits and should be checked against patch notes when seeding.
 */
import {
  readFile,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import {
  fileURLToPath
} from 'node:url';
import {
  heroes,
  heroSlugs,
  maps
} from '../shared/domain.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourcesPath = path.join(root, 'shared', 'knowledge-sources.json');

/** Official-style kit notes keyed by CN hero name */
const kits = {
  '温斯顿': '特斯拉炮近距持续伤害；喷射背包跳入与落地震荡；屏障发射器投放球形护盾；原始暴怒强化近战。',
  '破坏球': '四轮机枪；抓钩甩动加速；适应性护盾；地雷场；碾压球形态撞击。',
  '莱因哈特': '火箭锤；屏障力场；冲锋；烈焰打击；大地粉碎。',
  'D.Va': '融合机炮；推进器；防御矩阵拦截射弹；微型飞弹；自爆与呼叫机甲。',
  'D.Mon': '机甲近战与便携火力；护甲与推进器燃料受版本数值约束；注意护甲与冷却改动。',
  '查莉娅': '粒子炮光束/榴弹；粒子屏障与投影屏障积攒能量；重力喷涌。',
  '西格玛': '超能之球；实验屏障；动能汲取吸星；质量吸附击倒；引力崩坏。',
  '路霸': '爆裂枪；钩链；废品压缩器可吸弹反击；吸血（治疗）。',
  '奥丽莎': '增压熔融炮；投枪；御马蛮力；防御力场类工具视版本配置。',
  '末日铁拳': '手炮；火箭重拳；上勾拳；震地波；毁天灭地。',
  '拉玛刹': '虚空加速器/法杖形态切换；吞噬旋涡；虚空屏障；歼灭。',
  '渣客女王': '锯齿利刃与砍刀；狂风猛刮；指令：欢呼；屠戮。',
  '毛加': '链式机枪；烈焰冲刺；心脏过载；笼中野兽。',
  '飞天猫': '机动坦型工具组；以版本技能页为准核对位移与护盾。',
  '猎空': '脉冲双枪；闪现；闪回；脉冲炸弹。',
  '源氏': '手里剑；影武；飞镖；斩（版本可能调整技能位）。',
  '士兵：76': '重型脉冲步枪；螺旋飞弹；疾跑；生物力场；战术目镜。',
  '卡西迪': '维和者；闪光弹；滚地翻；午时已到。',
  '艾什': '杠杆枪；动力滑铲；教练枪；B.O.B.。',
  '黑百合': '吻吻枪；钩索；剧毒地雷；红外侦测。',
  '半藏': '风暴之弓；音速箭；裂箭；龙魂击。',
  '狂鼠': '榴弹发射器；震荡地雷；捕兽夹；炸弹轮胎。',
  '托比昂': '铆钉枪；锻造锤；部署炮台；过载；熔火核心。',
  '堡垒': '搜索/炮台形态；A-36战术榴弹；重配置；坦克形态视配置。',
  '回声': '三角射击；飞行；黏性炸弹；聚焦光线；复制。',
  '法老之鹰': '火箭发射器；跳跃喷射；震荡冲击；弹幕。',
  '死神': '地狱火霰弹枪；幽灵形态；影之步；死亡绽放。',
  '美': '喷霜器；急冻；冰墙；暴雪。',
  '探奇': '智能钻头与地雷；钻地位移；以官方技能页核对爆发窗口。',
  '索杰恩': '轨道射电；强力滑动；干扰击；超能之龙。',
  '骇灾': '版本机动输出工具组；以官方技能页核对位移与爆发。',
  '弗蕾雅': '缚锤射击；快速冲刺；精确瞄准；上升气流。',
  '埃姆雷': '虹吸冲击枪；赛博手雷；覆盖协议等；注意跳跃与重力版本调整。',
  '秩序之光': '光子发射器；哨戒塔；传送面板；光子屏障。',
  '西拉': '螺旋步枪持续开火提高精度；追踪弹标记目标后步枪子弹可追踪被标记者；震地手雷；锚点无人机可改变位置；大招开路先锋部署轰炸无人机。',
  '死怨': '双枪连射与高机动冲刺；摩托冲阵；以官方技能页核对绕后与爆发。',
  '斩仇': '近战与剑气类工具；旋风疾步等异能受版本调整；以官方技能页为准。',
  '安燃': '地面压制型火力；以官方技能页核对冷却与位移。',
  '安娜': '生物枪；睡眠镖；生物手雷；纳米激素。',
  '雾子': '苦无；治疗护符；瞬步；清净之铃；狐灵。',
  '卢西奥': '音速放大器治疗/加速切换；音波墙；音障。',
  '布丽吉塔': '火箭链锤；恢复包；鞭抽；屏障盾；集结。',
  '禅雅塔': '毁灭宝珠；谐球体；踢腿；超然入定。',
  '莫伊拉': '生化之握；消散；生化之球；聚合射线。',
  '巴蒂斯特': '生化发射器；维生力场可被摧毁；浸液枪；增幅矩阵。',
  '天使': '天使权杖；守护天使；复活；安魂祈祷。',
  '生命之梭': '治愈之花；生命之握；花台；树潮。',
  '伊拉锐': '太阳步枪；治疗阳炎；爆发阳炎；夺日。',
  '朱诺': '双脉冲空对地火炮；高抛护盾；环轨萤火；轨道射线。',
  '黑影': '现版本支援向黑客；在线修复治疗；赛博空间削弱敌人；隐身与位移器仍可用于走位。',
  '血律': '永生权杖中远距离治疗与伤害；蝙蝠无人机强化队友；灌注强化技能；大招重分配双方生命值。',
  '无漾': '风暴与洪流相关工具组；以官方技能页核对位移与控场。'
};

const mapNotes = {
  '国王大道': { mode: '攻击/护送', tip: 'A 点雕像与拱门是温斯顿类英雄常见过渡点；注意二楼窗口与楼梯抢位。' },
  '多拉多': { mode: '护送', tip: '车身两侧高台与斜角比正门硬撞更安全；后半段注意桥面枪线。' },
  '漓江塔': { mode: '占领', tip: '夜市/控制点周围高台与转点多；占点后优先卡楼梯与侧门。' },
  '监测站：直布罗陀': { mode: '护送', tip: '开局高台与侧路绕后常见；落点要能立刻进掩体。' },
  '直布罗陀监测站': { mode: '护送', tip: '与监测站：直布罗陀同图；核对开局高台与侧路。' },
  '努巴尼': { mode: '攻击/护送', tip: 'A 点侧路与二楼压力大；推车段注意直角拐弯被夹击。' },
  '好莱坞': { mode: '攻击/护送', tip: '摄影棚内外转点多；占点后卡门框比空地对枪更稳。' },
  '伊利奥斯': { mode: '占领', tip: '废墟/井/灯塔三图高台差异大；先抢垂直优势再换点。' },
  '里阿尔托': { mode: '护送', tip: '桥面与水道两侧高台；注意长距离狙击线。' },
  '艾兴瓦尔德': { mode: '攻击/护送', tip: '城堡门与桥是交战瓶颈；侧门绕后改变枪线。' },
  '香巴里寺院': { mode: '护送', tip: '多层平台与落差；跳跃英雄要预留撤退高度。' },
  '霓虹枢纽': { mode: '攻击/护送', tip: '东京街巷与高台交错；占点后沿巷道推车，留意暗巷绕后。' },
  '监测站：格里姆火山': { mode: '护送', tip: '冰火地形与监狱结构；开阔点位依赖掩体与罩类技能。' },
  '南极半岛': { mode: '占领', tip: '实验室/冰崖等点垂直空间大；注意坠落与高台互换。' },
  '斗兽场': { mode: '推车', tip: '环形空间；卡推车两侧夹角，避免被绕圈。' },
  '埃斯佩兰萨': { mode: '推车', tip: '推车路线弯道多；提前占弯角高台。' },
  '釜山': { mode: '占领', tip: '三控制点轮换；掉点后快速转点比恋战重要。' },
  '绿洲城': { mode: '占领', tip: '大学等高台视野好；注意被绕后切后排。' },
  '尼泊尔': { mode: '占领', tip: '圣坛/村庄等近点混战多；近战坦更吃墙角。' },
  '哈瓦那': { mode: '护送', tip: '长直线与侧街；注意狙击手与侧翼。' },
  '渣客镇': { mode: '护送', tip: '近战友好的狭窄巷道；爆炸物英雄收益高。' },
  '暴雪世界': { mode: '攻击/护送', tip: '园区多层；滑梯与室内转点需提前规划落点。' },
  '帕拉伊苏': { mode: '攻击/护送', tip: '海岸与坡道；注意高低差换枪线。' },
  '阿德勒斯布鲁恩': { mode: '攻击/护送', tip: '雪地开阔与建筑掩体交替；远程英雄更吃掩体。' }
};

function heroUrl(name) {
  const slug = heroSlugs[name] || name.toLowerCase();
  return 'https://overwatch.blizzard.com/en-us/heroes/' + slug + '/';
}

function heroCard(name) {
  const kit = kits[name] || '以暴雪官方英雄页当前版本技能组为准。';
  const excerpt = name + '：' + kit;
  return {
    id: 'version-ability-' + (heroSlugs[name] || name),
    url: heroUrl(name),
    role: '版本',
    author: '暴雪娱乐',
    sourceTitle: 'Overwatch Heroes · ' + name,
    heroes: [name],
    stage: '技能',
    tags: ['版本', '技能', '官方机制', name],
    title: name + '·当前版本技能要点',
    principle: kit + '复盘时以官方技能页与最新补丁为准。',
    application: '回看交技能前后两秒：该技能是否打在它设计要解决的问题上（进场、保命、打断、收割）。',
    kind: '官方机制',
    excerpt
  };
}

function mapCard(name) {
  const info = mapNotes[name] || { mode: '竞赛地图', tip: '对照官方地图结构核对高台、门框与转点。' };
  const excerpt = name + '（' + info.mode + '）：' + info.tip;
  const id = 'version-map-' + name.replace(/[：:\s]/g, '-');
  return {
    id,
    url: 'https://overwatch.blizzard.com/en-us/maps/',
    role: '版本',
    author: '暴雪娱乐',
    sourceTitle: 'Overwatch Maps · ' + name,
    heroes: [],
    maps: [name],
    stage: '落位',
    tags: ['版本', '地图', info.mode, name],
    title: name + '·地图落位要点',
    principle: info.tip,
    application: '暂停在你第一次进点或过角处：对照本图关键高台/门框，你的落点能不能一步进掩体。',
    kind: '官方机制',
    excerpt
  };
}

const existing = JSON.parse(await readFile(sourcesPath, 'utf8'));
const keep = existing.filter(c => !String(c.id || '').startsWith('version-ability-') && !String(c.id || '').startsWith('version-map-'));
const generated = [
  ...heroes.map(heroCard),
  ...[...new Set(maps)].map(mapCard)
];
const merged = [...keep, ...generated];
await writeFile(sourcesPath, JSON.stringify(merged, null, 2) + '\n');
console.log('Wrote ' + generated.length + ' version cards into knowledge-sources (' + merged.length + ' total sources)');
