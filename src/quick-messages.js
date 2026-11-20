export const QUICK_GROUPS = [
  { name: 'Emotes', items: [['wave','Wave'],['heart','Love it'],['star','All star'],['crown','Royal']] },
  { name: 'Team', items: [['mine','Mine!'],['set','Set me!'],['cover','Cover me!'],['yours','Yours!']] },
  { name: 'Cheers', items: [['nice','Nice shot!'],['thanks','Thanks!'],['close','So close!'],['gg','Good game!']] }
];
export const QUICK_LABELS = new Map(QUICK_GROUPS.flatMap(group => group.items));
