// Coral Bay Heat — Harbor Nights story pack.
// Adds Valen Cruz and three late-night harbor missions to the main story.
// The mission engine reads CBH.missionsData.MISSIONS live, so appending
// here extends the campaign after the original eight missions.
(function () {
  'use strict';
  window.CBH = window.CBH || {};

  if (!window.CBH.missionsData || !Array.isArray(window.CBH.missionsData.MISSIONS)) {
    return;
  }

  var data = window.CBH.missionsData;

  for (var i = 0; i < data.MISSIONS.length; i++) {
    if (data.MISSIONS[i] && data.MISSIONS[i].id === 'neon-manifest') {
      return;
    }
  }

  data.PEOPLE = data.PEOPLE || {};
  data.PEOPLE.valen = {
    name: 'Valen Cruz',
    color: '#e879f9',
    initial: 'V'
  };

  data.MISSIONS.push(
    {
      id: 'neon-manifest',
      title: 'Neon Manifest',
      giver: 'valen',
      brief: 'Tail a courier through the port and clear the warehouse crew.',
      start: { x: 214, z: 66 },
      reward: 700,
      intro: [
        { who: 'valen', text: 'You came down to the water after dark, Mari. That already tells me you need money more than sleep.' },
        { who: 'mari', text: 'Severo keeps a ledger with my name in it. I am not here for the view, Valen.' },
        { who: 'valen', text: 'Then listen. A courier runs a false manifest through my docks tonight. Follow him, learn where he unloads, and do not let him know the harbor has eyes.' },
        { who: 'valen', text: 'When he stops at the warehouse, his friends will try to keep the secret. Make sure the secret is the only thing that stays buried down there.' }
      ],
      steps: [
        { kind: 'goto', x: 214, z: 66, label: 'Meet Valen at the Port rendezvous' },
        {
          kind: 'followCar',
          label: 'Follow the courier without spooking him',
          carType: 'sedan',
          carColor: 0x334155,
          spawn: { x: 44, z: 20, heading: 0 },
          route: [
            { x: 120, z: 20 },
            { x: 120, z: -60 },
            { x: 200, z: -60 },
            { x: 214, z: -104 }
          ]
        },
        { kind: 'shootout', x: 214, z: -116, label: 'Clear the warehouse crew', gunmen: 3 }
      ],
      outro: [
        { who: 'valen', text: 'Clean work, and quiet too. That manifest had names on it that would have drowned half the dock, mine included.' },
        { who: 'mari', text: 'You owe me more than thanks. Put it against what I owe Luna.' },
        { who: 'valen', text: 'Already done. Seven hundred off the noise, and a little quieter water for both of us.' }
      ]
    },
    {
      id: 'armored-courtesy',
      title: 'Armored Courtesy',
      giver: 'valen',
      brief: 'Lift an armored van from the port yard and deliver it to the lockup.',
      start: { x: 200, z: 44 },
      reward: 900,
      timer: 180,
      intro: [
        { who: 'valen', text: 'There is a van in my yard that officially does not exist. Unofficially, it is full of reasons Severo should stop threatening your aunt.' },
        { who: 'mari', text: 'You want me to steal an armored van in three minutes. Courtesy really has changed down here.' },
        { who: 'valen', text: 'It has an alarm with opinions, so move fast once you touch it. Tito will keep the lockup door open, but he will not wait all night.' },
        { who: 'tito', text: 'I heard that. I wait for family, Valen. For vans full of trouble, I keep the engine of my patience running and the meter ticking.' }
      ],
      steps: [
        { kind: 'goto', x: 200, z: 44, label: 'Reach the port yard' },
        {
          kind: 'pickupCar',
          label: 'Take the armored van',
          carType: 'van',
          carColor: 0x3b5bdb,
          spawn: { x: 206, z: 40, heading: Math.PI / 2 },
          alarm: true
        },
        {
          kind: 'driveTo',
          x: 156,
          z: -24,
          label: 'Deliver the van to the lockup',
          mustBeInMissionCar: true
        }
      ],
      outro: [
        { who: 'valen', text: 'You brought it in with the paint still honest. That is rarer than the cargo.' },
        { who: 'mari', text: 'Tell Luna the harbor paid another piece of my debt. Tell him I am keeping count too.' },
        { who: 'valen', text: 'He will hear it exactly like that. Men like Severo respect a ledger that talks back.' }
      ]
    },
    {
      id: 'harbor-lights',
      title: 'Harbor Lights',
      giver: 'valen',
      brief: 'Run down a thief at the marina and hold the boardwalk until dawn.',
      start: { x: 52, z: 226 },
      reward: 1200,
      intro: [
        { who: 'valen', text: 'Last job, Mari. A thief lifted the harbor payroll and thinks a fast car makes him invisible. Prove the lights on this bay see everything.' },
        { who: 'mari', text: 'And when I catch him?' },
        { who: 'valen', text: 'Bring the trouble back to the marina. His friends will come to bargain with bullets. Hold the boardwalk, and this account between you and Luna gets a lot smaller.' },
        { who: 'mari', text: 'Then tonight the harbor pays its debts. All of them.' }
      ],
      steps: [
        {
          kind: 'chaseCar',
          label: 'Chase down the payroll thief',
          carType: 'convertible',
          carColor: 0xff6b4a,
          spawn: { x: 66, z: -150, heading: 0 }
        },
        { kind: 'goto', x: 52, z: 226, label: 'Return to the marina boardwalk' },
        { kind: 'shootout', x: 52, z: 226, label: 'Hold the marina boardwalk', gunmen: 4 }
      ],
      outro: [
        { who: 'valen', text: 'It is done. I just spoke to Luna\'s man — your marker is paid down, Mari, properly paid down. What is left is small enough to breathe around.' },
        { who: 'mari', text: 'I came to these docks owing a monster money. I did not expect to leave with a friend who keeps receipts.' },
        { who: 'valen', text: 'Not a friend. Family, harbor rules. And as of tonight, the night docks are yours to run — anyone who works after dark answers to you first.' },
        { who: 'boss', text: 'Valen tells me the harbor settled part of your account, Miss Solano. Keep making yourself useful, and perhaps we stay… courteous.' }
      ]
    }
  );
})();
