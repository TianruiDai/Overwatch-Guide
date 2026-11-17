export const examples = [{
    id: 'kings-row',
    map: '国王大道',
    art: 'kings-row',
    role: '重装',
    hero: '温斯顿',
    topic: 'A 点进攻的第一跳',
    intro: '在雕像旁准备进攻 A 点。先看队友能否穿门、落点有没有掩体，再决定要不要交跳跃背包。',
    moments: [{
        title: '门口准备',
        situation: '你在拱门外，己方后排仍在转角。守方有人从雕像后方观察门口。',
        action: '先利用门边掩体观察。等队友有射线或能同步过门，再给出进场信号。',
        note: 'spilo-tank-engage'
      },
      {
        title: '雕像落位',
        situation: '队友已经到门边，雕像和建筑外墙都能隔断一部分防守火力。',
        action: '先选能绕掩体的落点。落地后沿遮挡观察后排的视线，再决定向点内追还是收回。',
        note: 'winston-kings-row'
      },
      {
        title: '第二次接触',
        situation: '目标退到房角后，己方输出还没有看到它。',
        action: '以雕像为中转整理技能，等队友开出射线再向前压。复看时标记队友第一次能跟枪的位置。',
        note: 'spilo-tank-engage'
      }
    ]
  },
  {
    id: 'dorado',
    map: '多拉多',
    art: 'dorado',
    role: '输出',
    hero: '士兵：76',
    topic: '高台侧角与集火',
    intro: '车经过街道前方的转角。用相邻高台建立第二条射线，观察对手何时必须同时照顾两个方向。',
    moments: [{
        title: '选择侧角',
        situation: '你的主坦在车旁吸引注意，旁边有一处背靠墙面的高台。',
        action: '从能缩回墙后的角度观察同一个目标，先估算暴露时间，再开火。',
        note: 'spilo-dps-angles'
      },
      {
        title: '对齐开火时机',
        situation: '队友尚未绕过街角，敌方视线集中在你所在的高台。',
        action: '回到掩体，等主路出现接触再探头，把单人架枪变成两路交叉火力。',
        note: 'spilo-dps-angles'
      }
    ]
  },
  {
    id: 'lijiang',
    map: '漓江塔',
    art: 'lijiang',
    role: '辅助',
    hero: '安娜',
    topic: '点外站位与治疗视线',
    intro: '队伍从点外进入控制区。跟队友的移动调整视角，在掩体边同时保留治疗和施压的机会。',
    moments: [{
        title: '转角前换位',
        situation: '己方坦克即将绕入点内，当前掩体很快会挡住治疗视线。',
        action: '沿掩体提前挪向下一处观察角，确认能看到队友，再看是否有安全的输出窗口。',
        note: 'spilo-support-pressure'
      },
      {
        title: '确认激素目标',
        situation: '队友准备进场，你有纳米激素，但尚未看清对方的站位。',
        action: '先约定一个可见的进场信号。复看时检查开大瞬间目标是否还有距离、血量和技能可用。',
        note: 'ml7-ana-nano'
      }
    ]
  }
];
