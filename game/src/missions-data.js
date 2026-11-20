// missions-data.js — the story of Coral Bay Heat as data: eight missions
// with their cast, dialogue, objectives, checkpoints and rewards, plus the
// taxi fare rules, the two street races and the stunt/ramp flavour text.
// missions.js runs this data; nothing here executes.
(function () {
  'use strict';
  window.CBH = window.CBH || {};

  const PEOPLE = {
    mari:  { name: 'Mari Solano', color: '#14b8a6', initial: 'M' },
    rosa:  { name: 'Aunt Rosa', color: '#ff9f68', initial: 'R' },
    tito:  { name: 'Tito Vidal', color: '#e05252', initial: 'T' },
    ines:  { name: 'Ines Prado', color: '#7a5fd0', initial: 'I' },
    marco: { name: 'Marco Reyes', color: '#4f7fd9', initial: 'K' },
    dealer:{ name: 'The Middleman', color: '#555f6e', initial: '?' },
    boss:  { name: 'Severo Luna', color: '#2b2b33', initial: 'S' },
  };

  // Step kinds the runner understands:
  //  goto      — reach the marker (on foot or in any car)
  //  driveTo   — reach the marker while driving (passenger/cargo rides along)
  //  pickupCar — get into the named mission car
  //  chaseCar  — stop the fleeing target car (ram it until it dies / catch it)
  //  followCar — tail the target car, stay in the band, do not spook it
  //  shootout  — defeat every gunman at the marker
  //  defend    — survive waves at the marker until the timer ends
  //  escapeTo  — reach the marker with the heat on; heat clears on arrival
  const MISSIONS = [
    {
      id: 'welcome-home',
      title: 'Welcome Home',
      giver: 'rosa',
      brief: 'Aunt Rosa needs a ride from the marina to her cafe.',
      start: { x: 52, z: 226 },
      reward: 150,
      intro: [
        { who: 'rosa', text: 'Mari! Look at you. Ten years gone and the bay still smells the same, eh?' },
        { who: 'mari', text: 'Aunt Rosa. I came home to settle things. Severo Luna says I owe him.' },
        { who: 'rosa', text: 'Ay. Then you work, you pay, you are free. First — drive your old aunt to the cafe. My feet are killing me.' },
      ],
      steps: [
        { kind: 'goto', x: 52, z: 226, label: 'Meet Aunt Rosa at the marina boardwalk' },
        { kind: 'driveTo', x: -52, z: 44, label: 'Drive Aunt Rosa to Cafe Rosa', passenger: 'rosa' },
      ],
      outro: [
        { who: 'rosa', text: 'You still drive like the devil owes YOU money. Good. Tito Vidal collects for Luna — he will find you. Be ready.' },
      ],
    },
    {
      id: 'collections',
      title: 'Collections',
      giver: 'tito',
      brief: 'Three debtors in Palm Heights owe Luna money. Visit them all before the timer runs out.',
      start: { x: -52, z: 52 },
      reward: 400,
      timer: 240,
      intro: [
        { who: 'tito', text: 'Solano. Luna says you drive, I say you collect. Three names in Palm Heights. Knock, smile, take the envelopes.' },
        { who: 'mari', text: 'And if they do not want to pay?' },
        { who: 'tito', text: 'Then you persuade them. Clock is running, driver.' },
      ],
      steps: [
        { kind: 'goto', x: -160, z: -168, label: 'Collect from the first debtor in Palm Heights' },
        { kind: 'goto', x: -66, z: -222, label: 'Collect from the second debtor' },
        { kind: 'goto', x: 66, z: -168, label: 'Collect from the third debtor' },
        { kind: 'chaseCar', label: 'Stop the fleeing debtor!', carType: 'hatch', carColor: 0x53b06a, spawn: { x: 66, z: -150, heading: 0 } },
      ],
      outro: [
        { who: 'tito', text: 'All three envelopes. Luna will be pleased. Do not get comfortable — the work gets dirtier from here.' },
      ],
    },
    {
      id: 'hot-cargo',
      title: 'Hot Cargo',
      giver: 'tito',
      brief: 'A sports car sits in the Port with no owner worth mentioning. Take it to the lockup.',
      start: { x: -52, z: 52 },
      reward: 550,
      intro: [
        { who: 'tito', text: 'There is a coral-red sports car at the Port, keys in, alarm live. It needs to be in our lockup across the yard.' },
        { who: 'mari', text: 'The alarm draws the police, Tito.' },
        { who: 'tito', text: 'Then drive fast, Solano. That is literally your whole thing.' },
      ],
      steps: [
        { kind: 'goto', x: 214, z: 66, label: 'Reach the marked sports car at the Port' },
        { kind: 'pickupCar', label: 'Steal the sports car', carType: 'sports', carColor: 0xff5030, spawn: { x: 214, z: 58, heading: Math.PI / 2 }, alarm: true },
        { kind: 'driveTo', x: 156, z: -24, label: 'Deliver the car to the lockup', mustBeInMissionCar: true },
      ],
      outro: [
        { who: 'tito', text: 'Not a scratch that matters. Luna is starting to remember why he kept you alive.' },
      ],
    },
    {
      id: 'beach-party-bust',
      title: 'Beach Party Bust',
      giver: 'ines',
      brief: 'Ines is throwing a beach party. Someone there has Luna\'s cash case. Take it back — on foot.',
      start: { x: -206, z: 100 },
      reward: 600,
      intro: [
        { who: 'ines', text: 'Mari Solano, as I live and breathe! My party, my beach — and that silver case by the crates? It is Luna\'s money, and his boys are coming for it.' },
        { who: 'mari', text: 'So I grab it first and run. Story of my life.' },
        { who: 'ines', text: 'Run pretty, querida. The police scanner says they are two minutes out.' },
      ],
      steps: [
        { kind: 'goto', x: -238, z: 100, label: 'Reach the beach party clearing', onFoot: true },
        { kind: 'goto', x: -232, z: 108, label: 'Grab the cash case', onFoot: true, grantsHeat: 2 },
        { kind: 'escapeTo', x: -52, z: 44, label: 'Escape to Cafe Rosa with the case' },
      ],
      outro: [
        { who: 'rosa', text: 'You smell like sunscreen and trouble. The case is full — Luna\'s cut is paid. Ines says you were magnificent.' },
      ],
    },
    {
      id: 'the-middleman',
      title: 'The Middleman',
      giver: 'marco',
      brief: 'Tail the Middleman\'s car to his warehouse deal. Stay close, stay unseen — then survive the deal.',
      start: { x: 44, z: 44 },
      reward: 800,
      intro: [
        { who: 'marco', text: 'Mari. Marco Reyes — I fix things for people who owe Luna. The Middleman skims every deal in this city. Follow his grey sedan, do not let him smell you.' },
        { who: 'mari', text: 'And when he stops?' },
        { who: 'marco', text: 'Then it gets loud. I left a pistol for you in the glovebox of the blue sedan by the cafe. You will want it.' },
      ],
      steps: [
        { kind: 'goto', x: 44, z: 44, label: 'Get to the tail position downtown' },
        { kind: 'followCar', label: 'Tail the Middleman — stay close but unseen', carType: 'sedan', carColor: 0x6a7076, spawn: { x: 44, z: 20, heading: 0 }, route: [{ x: 120, z: 20 }, { x: 120, z: -60 }, { x: 200, z: -60 }, { x: 214, z: -104 }] },
        { kind: 'shootout', x: 214, z: -116, label: 'Survive the ambush at the warehouse!', gunmen: 4 },
      ],
      outro: [
        { who: 'marco', text: 'The Middleman is done skimming. Luna owes you now — almost. One more push, driver.' },
      ],
      grantsPistol: true,
    },
    {
      id: 'night-run',
      title: 'Night Run',
      giver: 'tito',
      brief: 'A midnight package run from the marina to the far side of the Port. Timed. Hot.',
      start: { x: 124, z: 226 },
      reward: 1000,
      timer: 170,
      nightRun: true,
      intro: [
        { who: 'tito', text: 'Package at the Heron Pier. Buyer waits at the north Port gate. Night roads, no headlights-off heroics, and the PD is bored tonight.' },
        { who: 'mari', text: 'Timed and hot. You do love giving me the easy ones, Tito.' },
      ],
      steps: [
        { kind: 'goto', x: 124, z: 226, label: 'Pick up the package at Heron Pier' },
        { kind: 'driveTo', x: 232, z: -196, label: 'Deliver to the north Port gate — go!', heatRamp: true },
      ],
      outro: [
        { who: 'tito', text: 'Delivered, and the buyer paid double for the speed. Luna\'s ledger is nearly balanced, Solano.' },
      ],
    },
    {
      id: 'settle-up',
      title: 'Settle Up',
      giver: 'rosa',
      brief: 'A rival crew blames Mari for the Middleman. They are coming for Cafe Rosa. Hold the street.',
      start: { x: -52, z: 52 },
      reward: 1200,
      intro: [
        { who: 'rosa', text: 'Cars outside, Mari. The Middleman\'s crew — they say you cost them everything and they have come to collect in lead.' },
        { who: 'mari', text: 'Get inside and lock the door, tia. Nobody burns your cafe while I am home.' },
      ],
      steps: [
        { kind: 'defend', x: -52, z: 44, label: 'Defend Cafe Rosa!', duration: 75, waves: 3 },
      ],
      outro: [
        { who: 'rosa', text: 'My street, my cafe, my niece. Luna heard what you did here — he wants one last job, and then your debt is ash.' },
      ],
    },
    {
      id: 'the-harbour-job',
      title: 'The Harbour Job',
      giver: 'boss',
      brief: 'The finale. Load the marked boat trailer at the Port and run the whole PD to the marina hideout.',
      start: { x: 226, z: -44 },
      reward: 2500,
      intro: [
        { who: 'boss', text: 'Solano. Severo Luna, in person. One job stands between you and a clean ledger: my boat trailer waits at the Port. Hook it, and bring it home to the marina.' },
        { who: 'mari', text: 'And the entire police force that comes with it?' },
        { who: 'boss', text: 'Is the price of freedom, driver. Pay it or owe me forever.' },
      ],
      steps: [
        { kind: 'goto', x: 226, z: -44, label: 'Reach the boat trailer at the Port' },
        { kind: 'pickupCar', label: 'Take the trailer truck', carType: 'pickup', carColor: 0x30343a, spawn: { x: 226, z: -52, heading: Math.PI }, trailer: true },
        { kind: 'escapeTo', x: -124, z: 226, label: 'Escape to the marina hideout!', mustBeInMissionCar: true, finalHeat: 5 },
      ],
      outro: [
        { who: 'boss', text: 'The trailer is home, the ledger is closed, and Coral Bay is yours again, Mari Solano. Drive free.' },
        { who: 'mari', text: 'Free. Now I drive where I want... and somehow I keep ending up right here. Best city in the world.' },
      ],
    },
  ];

  const TAXI = {
    farePerMeter: 0.55,
    tipWindowRatio: 0.5, // arrive within distance/speed * ratio for a tip
    passengerNames: ['a tourist with a camera', 'a nurse on her way to the clinic', 'a surfer with a board bag', 'an old fisherman', 'a jazz singer', 'a student late for class', 'a chef carrying a knife roll', 'a sailor back from sea'],
  };

  const RACES = [
    {
      id: 'coast-run',
      name: 'Coast Run',
      start: { x: 238, z: 196, heading: Math.PI },
      checkpoints: [
        { x: 246, z: 60 }, { x: 246, z: -120 }, { x: 160, z: -246 }, { x: 0, z: -246 },
        { x: -160, z: -246 }, { x: -246, z: -120 }, { x: -246, z: 60 }, { x: -160, z: 246 }, { x: 60, z: 246 },
      ],
      parSeconds: 150,
      reward: 500,
    },
    {
      id: 'downtown-dash',
      name: 'Downtown Dash',
      start: { x: 40, z: -196, heading: 0 },
      checkpoints: [
        { x: -40, z: -120 }, { x: -120, z: -40 }, { x: -40, z: 40 }, { x: 40, z: 120 },
        { x: 120, z: 40 }, { x: 120, z: -60 }, { x: 40, z: -120 },
      ],
      parSeconds: 95,
      reward: 400,
    },
  ];

  const FREE_ROAM_TIPS = [
    'Find the gold marker to start the next job',
    'Taxi passengers wait at gold rings — pick them up in any car',
    'Two street races start at the chequered markers',
    'Twenty golden shells are hidden around Coral Bay',
    'The Port ramps launch cars — land a stunt jump for cash',
    'Lose the police by breaking line of sight to cool your stars',
  ];

  window.CBH.missionsData = {
    PEOPLE: PEOPLE,
    MISSIONS: MISSIONS,
    TAXI: TAXI,
    RACES: RACES,
    FREE_ROAM_TIPS: FREE_ROAM_TIPS,
  };
})();
