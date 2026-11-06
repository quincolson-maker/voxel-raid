// Base layouts as data. Coordinates relative to map center. walls: [x0,z0,x1,z1] rectangles (outline) or lines; gaps: cells cleared.
// buildings: [kind, x, z]. Add new layouts by appending to this array.
export const LAYOUTS = [
 { name:'Citadel Ring', desc:'Centralized core inside double ring (classic core-protection archetype)',
   rects:[[-6,-6,6,6],[-16,-16,16,16]], lines:[], gaps:[],
   buildings:[['core',0,0],['turret',-10,-10],['turret',10,10],['turret',10,-10],['turret',-10,10],['mortar',0,-11],['mortar',0,11],
     ['vault',-12,0],['vault',12,0],['hut',-20,-20],['hut',20,20],['hut',-20,20],['hut',20,-20],['needle',0,-20],['trap',0,-18],['trap',0,18],['trap',18,0],['trap',-18,0]] },
 { name:'Honeycomb Grid', desc:'Compartmentalized 3x3 cells – every breach opens only one cell',
   rects:[[-21,-21,21,21]], lines:[[-7,-21,-7,21],[7,-21,7,21],[-21,-7,21,-7],[-21,7,21,7]], gaps:[],
   buildings:[['core',0,0],['turret',-14,-14],['turret',14,14],['mortar',14,-14],['mortar',-14,14],['vault',0,-14],['vault',0,14],
     ['needle',-14,0],['turret',14,0],['hut',-25,0],['hut',25,0],['trap',-3,-10],['trap',3,10]] },
 { name:'Sentinel Spread', desc:'Anti-air style spread: long-range needles pushed far apart, offset core',
   rects:[[-22,-22,22,22],[2,2,12,12]], lines:[], gaps:[],
   buildings:[['core',7,7],['needle',-17,-17],['needle',17,-17],['needle',-17,17],['needle',17,17],['turret',-8,0],['turret',0,-8],
     ['mortar',-8,-8],['vault',-15,5],['vault',5,-15],['hut',-3,15],['hut',15,-3],['trap',-2,-2],['trap',-12,-12]] },
 { name:'Gauntlet Funnel', desc:'Walls funnel raiders through a trapped corridor into crossfire',
   rects:[[-18,-4,18,22]], lines:[[-18,-4,-4,-18],[18,-4,4,-18],[-4,-4,-4,10],[4,-4,4,10]], gaps:[[0,-4],[1,-4],[-1,-4]],
   buildings:[['core',0,15],['turret',-9,4],['turret',9,4],['mortar',-12,14],['mortar',12,14],['needle',0,6],['vault',-11,-1],['vault',11,-1],
     ['trap',0,-2],['trap',0,1],['trap',0,4],['trap',0,8],['hut',-24,-10],['hut',24,-10]] },
];
