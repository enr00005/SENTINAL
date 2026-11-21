/* SENTINAL Assistant - drug-prevention awareness chatbot for the SafeWalk app.
   Self-contained: injects its own CSS and HTML, runs fully in the browser (no server, no API key),
   and does not touch any existing SafeWalk code. Messages are kept in memory only. */
(function () {
  'use strict';
  if (window.SentinalChat) return;

  // ---------------------------------------------------------------- styles
  var CSS = [
    '.wrap{padding-bottom:100px}',
    '.sc-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:2500;width:60px;height:60px;min-height:60px;margin:0;padding:0;border-radius:50%;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:var(--teal,#38d6d0);color:#05211f;box-shadow:0 8px 24px rgba(0,0,0,.5)}',
    '.sc-fab svg{width:28px;height:28px}',
    '.sc-fab[hidden]{display:none}',
    '.sc-panel{position:fixed;inset:0;z-index:2600;display:none;flex-direction:column;background:var(--bg,#070e1a);color:var(--tx,#e9f0fa);font-size:16px;line-height:1.5}',
    '.sc-panel.open{display:flex}',
    '@media(min-width:700px){.sc-panel{inset:auto 20px 20px auto;width:420px;height:min(680px,calc(100vh - 40px));border:1px solid var(--line,#223552);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.65);overflow:hidden}}',
    '.sc-head{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;border-bottom:1px solid var(--line,#223552);background:var(--s1,#0f1a2b)}',
    '.sc-head div{flex:1;min-width:0}',
    '.sc-head b{display:block;font-size:1.05rem;letter-spacing:.04em}',
    '.sc-head span{display:block;color:var(--mu,#8da2bd);font-size:.85rem}',
    '.sc-x{width:44px;height:44px;min-height:44px;margin:0;padding:0;border-radius:12px;background:var(--s2,#15253d);color:var(--tx,#e9f0fa);font-size:1.4rem;line-height:1;display:flex;align-items:center;justify-content:center}',
    '.sc-sos{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;padding:8px 16px;background:rgba(255,77,94,.14);color:#ffd5d9;font-size:.9rem}',
    '.sc-sos a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:56px;padding:0 14px;border-radius:99px;background:var(--red,#ff4d5e);color:#fff;font-weight:700;text-decoration:none}',
    '.sc-log{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 14px 6px;display:flex;flex-direction:column;gap:10px}',
    '.sc-m{max-width:90%;padding:10px 14px;border-radius:16px;overflow-wrap:anywhere;animation:scIn .2s ease}',
    '.sc-m p{margin:0 0 .5em}.sc-m p:last-child{margin-bottom:0}',
    '.sc-m ul{margin:.2em 0 .5em;padding-left:1.15em}.sc-m li{margin:.25em 0}',
    '.sc-m a{color:var(--teal,#38d6d0);font-weight:700}',
    '.sc-bot{align-self:flex-start;background:var(--s2,#15253d);border-bottom-left-radius:4px}',
    '.sc-me{align-self:flex-end;background:var(--teal,#38d6d0);color:#05211f;border-bottom-right-radius:4px;font-weight:600}',
    '.sc-chips{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0 8px}',
    '.sc-chip{width:auto;margin:0;min-height:44px;padding:8px 16px;border-radius:99px;font-size:.95rem;font-weight:600;background:transparent;color:var(--teal,#38d6d0);border:1px solid var(--teal,#38d6d0)}',
    '.sc-chip.act{background:var(--teal,#38d6d0);color:#05211f}',
    '.sc-typing{align-self:flex-start;display:flex;gap:5px;padding:14px 16px;background:var(--s2,#15253d);border-radius:16px}',
    '.sc-typing i{width:8px;height:8px;border-radius:50%;background:var(--mu,#8da2bd);animation:scDot 1s infinite}',
    '.sc-typing i:nth-child(2){animation-delay:.15s}.sc-typing i:nth-child(3){animation-delay:.3s}',
    '@keyframes scDot{0%,80%,100%{opacity:.3;transform:none}40%{opacity:1;transform:translateY(-4px)}}',
    '@keyframes scIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.sc-form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line,#223552);background:var(--s1,#0f1a2b)}',
    '.sc-form input{flex:1;min-width:0;margin:0;font-size:16px}',
    '.sc-send{width:56px;min-height:48px;margin:0;padding:0;border-radius:12px;background:var(--teal,#38d6d0);color:#05211f;display:flex;align-items:center;justify-content:center}',
    '.sc-send svg{width:22px;height:22px}',
    '.sc-note{padding:0 16px 8px;color:var(--mu,#8da2bd);font-size:.8rem;text-align:center;background:var(--s1,#0f1a2b)}',
    'body.sc-lock{overflow:hidden}',
    '@media(prefers-reduced-motion:reduce){.sc-m,.sc-typing i{animation:none}}'
  ].join('\n');

  // ---------------------------------------------------------------- knowledge base
  // Markup in answers: **bold**, {tel:NUMBER|label}, lines starting with "- " are bullets.
  var T = function (n) { return '{tel:' + n + '|' + n + '}'; };

  var LABEL = {
    what_is: 'What is drug abuse?', types: 'Common substances', why_start: 'Why people start',
    say_no: 'How to say no', signs: 'Signs in a friend', help_friend: 'Help a friend',
    parents: 'For parents & teachers', get_help: 'Get help & helplines', quit: 'I want to quit',
    overdose: 'Overdose emergency', withdrawal: 'Withdrawal', myths: 'Myths vs facts',
    stress: 'Stress & coping', legal: 'The law', report: 'Report drug selling',
    safe_tips: 'Walking & party safety', toofan: 'Operation Toofan',
    app_start: 'Using SafeWalk', app_sos: 'How SOS works', app_trip: 'Plan a trip for later',
    app_install: 'Install the app', privacy: 'Is this chat private?',
    cannabis: 'Cannabis', alcohol: 'Alcohol', tobacco: 'Tobacco & vapes', opioids: 'Opioids',
    party: 'Party & synthetic drugs', inhalants: 'Inhalants', prescription: 'Prescription pills'
  };
  var MAIN = ['what_is', 'say_no', 'signs', 'get_help', 'overdose', 'myths', 'safe_tips', 'app_start'];

  var HELPLINES = [
    '**Emergency:** ' + T('112') + ' (police, ambulance, fire) or ' + T('108') + ' (ambulance).',
    '**MANAS (Narcotics Control Bureau):** ' + T('1933') + ' - 24x7 toll-free national narcotics helpline. Report drug trafficking and ask about de-addiction counselling and rehabilitation services.',
    '**Tele-MANAS:** ' + T('14416') + ' - free mental-health counselling.',
    '**Kerala Police (Operation Toofan):** report drug activity on ' + T('9497979794') + ' or ' + T('9497927797') + ', or WhatsApp ' + T('9995966666') + '. Kerala Police say informants’ identities are kept confidential.',
    '**Childline:** ' + T('1098') + ' if you are under 18 and need help.'
  ];

  var KB = {
    greet: {
      a: ['Hi! I’m the **SENTINAL Assistant**. I can help with drug-prevention awareness, finding help, staying safe, and using SafeWalk.',
        'I’m an awareness assistant, not a doctor or counsellor. Pick a topic or type a question.'],
      next: MAIN
    },
    about: {
      a: ['I’m the SENTINAL Assistant, part of the SafeWalk app. I can talk about:',
        '- Drugs, alcohol and tobacco: what they do and why they’re risky',
        '- How to say no, and how to help a friend',
        '- Where to get help, including free helplines',
        '- Staying safe when walking or at parties',
        '- Using SafeWalk, SOS and trip planning',
        'I can’t give medical diagnosis, and I never give instructions for making, buying or using drugs.'],
      next: MAIN
    },
    what_is: {
      a: ['**Drug abuse** (substance misuse) means using alcohol, tobacco, illegal drugs or medicines in ways that harm your body, mind or life. For example, taking a medicine without a prescription, or using a substance to get high or to cope.',
        '**Addiction** is when a person can’t control their use even though it keeps causing harm. It changes how the brain handles reward, stress and self-control, so it is a health condition, not a weakness or a character flaw.',
        'The good news: prevention works, and recovery is possible with support.'],
      next: ['why_start', 'types', 'say_no', 'get_help']
    },
    types: {
      a: ['Common substances and their main risks (awareness only):',
        '- **Alcohol:** slows the brain, harms the liver, and is linked to accidents and violence.',
        '- **Tobacco and vapes:** nicotine is highly addictive and damages lungs and heart.',
        '- **Cannabis (ganja, charas):** affects memory, focus and mood.',
        '- **Opioids (heroin, “brown sugar”, misused painkillers):** can stop breathing.',
        '- **Party and synthetic drugs (MDMA, mephedrone, meth, cocaine):** strain the heart and can cause panic, overheating and paranoia.',
        '- **Inhalants (glue, thinners):** can cause sudden heart failure.',
        '- **Misused prescription pills:** dangerous with alcohol and easy to become dependent on.',
        'Tap one below to learn more.'],
      next: ['cannabis', 'alcohol', 'tobacco', 'opioids', 'party', 'prescription']
    },
    cannabis: {
      a: ['**Cannabis (ganja, charas, bhang)** is not harmless just because it comes from a plant.',
        '- Short term: slower reactions, poor memory and focus, and anxiety or paranoia in some people.',
        '- Regular use, especially when young, is linked to weaker school performance, dependence and mental-health problems.',
        '- Ganja and charas are illegal to possess, buy or sell under India’s NDPS Act.',
        'Never drive or walk alone in traffic after using it.'],
      next: ['myths', 'quit', 'legal']
    },
    alcohol: {
      a: ['**Alcohol** is a depressant: it slows the brain, so judgement, balance and reaction time suffer.',
        '- Short term: accidents, fights, unsafe situations and blackouts.',
        '- Long term: liver and heart damage, dependence, and harm to mental health.',
        '- Mixing it with other drugs or medicines can be deadly.',
        '- The legal drinking age differs by state, and drink-driving is illegal.',
        'For young people, the safest choice is not to start.'],
      next: ['withdrawal', 'safe_tips', 'get_help']
    },
    tobacco: {
      a: ['**Nicotine** in cigarettes, bidis, gutka, hookah and e-cigarettes is highly addictive.',
        '- Tobacco harms lungs, heart and mouth and causes cancer.',
        '- Vapes are not “safe”: they contain nicotine and other chemicals. E-cigarettes are banned for sale in India.',
        '- Tips to quit: pick a quit date, tell someone, avoid triggers, and ask a doctor about quit-smoking medicines.',
        'Relapse is common and is not failure. Try again.'],
      next: ['quit', 'myths', 'get_help']
    },
    opioids: {
      a: ['**Opioids** include heroin, “brown sugar”, morphine, and misused painkillers or cough syrups.',
        '- They slow or stop breathing. An overdose can kill quickly, especially when mixed with alcohol or sleeping pills.',
        '- They are highly addictive, and stopping suddenly is very uncomfortable. Medical treatment makes recovery safer.',
        '- Take medicines only as prescribed for you.'],
      next: ['overdose', 'withdrawal', 'get_help']
    },
    party: {
      a: ['**Party and synthetic drugs** (MDMA/ecstasy, mephedrone, LSD, meth, cocaine) are risky because:',
        '- Pills and powders often contain unknown ingredients, so no two doses are the same.',
        '- They can cause a racing heart, overheating, dehydration, panic, paranoia and hallucinations.',
        '- Mixing them with alcohol or other drugs raises the danger.',
        '- Drinks can also be spiked. Never accept a drink or food from someone you don’t trust.'],
      next: ['safe_tips', 'say_no', 'legal']
    },
    inhalants: {
      a: ['**Inhalants** (glue, thinners, correction fluid, petrol fumes) are cheap and easy to get, which is why they are dangerous for young people.',
        '- They can cause sudden heart failure, even the first time.',
        '- They damage the brain, liver and kidneys, and cause dizziness and loss of consciousness.',
        'If you notice a child sniffing fumes, stay calm and talk to a parent, teacher or doctor.'],
      next: ['help_friend', 'get_help']
    },
    prescription: {
      a: ['Some medicines (sleeping pills, anti-anxiety tablets, strong painkillers, some cough syrups) can be misused.',
        '- Take them only as prescribed for you. Never share or take someone else’s.',
        '- Never mix them with alcohol.',
        '- Don’t stop long-term sedatives suddenly. Ask a doctor how to reduce them safely.'],
      next: ['withdrawal', 'overdose', 'get_help']
    },
    why_start: {
      a: ['People try substances for many reasons: curiosity, peer pressure, stress, exam pressure, boredom, loneliness, family problems, or because films and social media make it look normal.',
        '**Raises the risk:** friends who use, easy access, starting young, untreated anxiety or depression, little support at home.',
        '**Protects:** a trusted person to talk to, hobbies and sport, knowing the facts, and the confidence to say no.'],
      next: ['say_no', 'stress', 'myths']
    },
    say_no: {
      a: ['You don’t need a reason to say no, but these lines help:',
        '- “No thanks, I’m good.” Short and calm works best.',
        '- “I have training / exams tomorrow.” An excuse is fine.',
        '- “Not my thing. What else are we doing?” Change the topic.',
        '- If they keep pushing, leave. Real friends respect your no.',
        '**Make a plan:** go with someone you trust, agree a code word with a family member to call you out, keep your phone charged, and share your trip with SafeWalk.',
        'Never accept food, drinks, sweets or lifts from people you don’t trust.'],
      next: ['safe_tips', 'help_friend', 'app_sos']
    },
    signs: {
      a: ['Possible warning signs. One alone proves nothing; a **pattern** matters:',
        '- **Body:** red eyes, sudden weight change, poor hygiene, unusual smells, constant tiredness or being unusually hyper.',
        '- **Behaviour:** secrecy, lying, new friends and dropping old ones, skipping school or work, falling grades, missing money.',
        '- **Mood:** irritability, anxiety, withdrawal, sudden mood swings.',
        '- **Items:** unusual pills, foil, pipes, syringes, or large amounts of eye drops or mouth fresheners.',
        'Don’t accuse. Approach with care.'],
      next: ['help_friend', 'parents', 'get_help']
    },
    help_friend: {
      a: ['How to help someone you’re worried about:',
        '- Pick a calm, private moment. Start with care: “I’m worried about you.” Avoid blame or threats.',
        '- Listen more than you talk. Don’t shame or lecture.',
        '- Share where help is available, and offer to go with them to a doctor or counsellor.',
        '- Stay in touch. Recovery often has setbacks, and that’s okay.',
        '- Look after yourself too. You can’t fix it alone.',
        'If they are in immediate danger, call ' + T('112') + '. For advice, call Tele-MANAS ' + T('14416') + ' or MANAS ' + T('1933') + '.'],
      next: ['get_help', 'overdose', 'signs']
    },
    parents: {
      a: ['**For parents and teachers:**',
        '- Talk early and often, with open questions rather than interrogation.',
        '- Set clear, calm rules, and know who your child’s friends are.',
        '- Watch for stress, bullying and low mood, which often come before substance use.',
        '- Keep medicines locked away, and set an example with your own habits.',
        '- If you find out, respond with support first. Punishment alone pushes problems into hiding.',
        '- Involve a doctor, counsellor or school counsellor. Operation Toofan runs awareness classes and counselling in Kerala schools and colleges.'],
      next: ['signs', 'get_help', 'toofan']
    },
    get_help: {
      a: ['Help is available. You can call for yourself or for someone else:'].concat(HELPLINES, [
        'You can also ask a doctor or visit a government hospital or district de-addiction centre. Asking for help is a sign of strength.']),
      next: ['quit', 'report', 'overdose', 'stress']
    },
    quit: {
      a: ['Wanting to stop is a big first step. Here is a way to start:',
        '- Tell one trusted person, and ask for their support.',
        '- See a doctor first. After heavy use of alcohol or sleeping pills, stopping suddenly can be dangerous.',
        '- Remove triggers: places, people and things linked to using.',
        '- Replace the habit: sport, walking, music, a routine and enough sleep.',
        '- Celebrate small wins. A slip is not failure; keep going.',
        'Free support: MANAS ' + T('1933') + ' or Tele-MANAS ' + T('14416') + '.'],
      next: ['withdrawal', 'get_help', 'stress']
    },
    overdose: {
      a: ['**This is an emergency. Call ' + T('112') + ' or ' + T('108') + ' now.** Don’t wait to see if they get better.',
        '- Stay with them. Tell the operator what was taken, if you know.',
        '- Check if they respond and are breathing. If they are unresponsive but breathing, lay them on their side so they can’t choke.',
        '- If they are not breathing and you know CPR, start it as the operator guides you.',
        '- Don’t give food or drink, and don’t try to make them vomit.',
        '- Never leave them alone. Keep any tablets or packaging to show the medics.',
        '- If naloxone is available and you are trained, use it for a suspected opioid overdose, and still call for help.'],
      next: ['get_help', 'withdrawal']
    },
    withdrawal: {
      a: ['Stopping suddenly after heavy or long-term use of **alcohol or sedatives** (sleeping or anxiety tablets) can cause seizures and can be life-threatening. Opioid withdrawal is very painful, though it is rarely dangerous by itself.',
        '**Don’t go cold turkey alone.** See a doctor or de-addiction centre. MANAS ' + T('1933') + ' can tell you where to go.',
        '**Call ' + T('112') + ' immediately** for seizures, confusion, hallucinations or chest pain.'],
      next: ['quit', 'get_help']
    },
    legal: {
      a: ['In India, the **NDPS Act, 1985** makes it an offence to possess, buy, sell, transport or consume narcotic drugs and psychotropic substances without authorisation.',
        '- Penalties depend on the substance and quantity, and can include long jail terms and heavy fines.',
        '- Never carry or “hold” a package for someone else. You can be held responsible.',
        '- A drug record can affect studies, jobs and travel. Under-18s are handled under the juvenile justice system, but the consequences are still serious.',
        'I’m not a lawyer. For legal advice, speak to a lawyer or a legal-aid service.'],
      next: ['say_no', 'report', 'get_help']
    },
    report: {
      a: ['If you know of drug selling or use, **don’t confront anyone or investigate yourself.** Stay safe and report it:',
        '- Kerala Police: ' + T('9497979794') + ' or ' + T('9497927797') + ', or WhatsApp ' + T('9995966666') + '. Kerala Police say informants’ identities are kept confidential.',
        '- National helpline MANAS: ' + T('1933') + '.',
        '- Immediate danger: ' + T('112') + '.',
        'Note only what you saw safely: place, time and description.'],
      next: ['get_help', 'toofan', 'legal']
    },
    myths: {
      a: ['**Myths vs facts:**',
        '- **“Just once won’t hurt.”** Any use carries risk: overdose, accidents, unknown ingredients. For some people, the first use is the start of dependence.',
        '- **“Vaping is safe.”** Vapes contain nicotine and other chemicals, and e-cigarettes are banned for sale in India.',
        '- **“Cannabis is natural, so harmless.”** It can harm memory, mood and learning, and it is illegal.',
        '- **“I can stop whenever I want.”** Dependence builds quietly. If you try to stop and can’t, that’s a sign to ask for help.',
        '- **“Everyone does it.”** Most young people don’t use drugs.',
        '- **“Only weak people get addicted.”** It can affect anyone, because it changes the brain.'],
      next: ['say_no', 'quit', 'get_help']
    },
    stress: {
      a: ['Stress, anxiety and loneliness are real and common. Substances may feel like relief, but they make these worse over time.',
        '**Things that help:**',
        '- Talk to someone you trust.',
        '- Move: sport, walking, yoga, dancing.',
        '- Keep a sleep and meal routine.',
        '- Try slow breathing: in for 4, out for 6, repeat 5 times.',
        '- Music, art, writing or any hobby that absorbs you.',
        'Free counselling: Tele-MANAS ' + T('14416') + '. If you ever feel hopeless or think of harming yourself, call ' + T('14416') + ' or ' + T('112') + ' right now.'],
      next: ['get_help', 'why_start', 'say_no']
    },
    safe_tips: {
      a: ['**Staying safe when out and about:**',
        '- Start a **Safe Journey** in SafeWalk so police can see your route.',
        '- Tell someone where you’re going and when you’ll be back.',
        '- Never accept drinks, food, cigarettes or lifts from strangers. Keep your own drink in sight.',
        '- If you feel suddenly dizzy, confused or very drowsy, tell a trusted person and get to a safe place. Seek medical help, because your drink may have been spiked.',
        '- Stay with friends, use well-lit routes, and trust your gut. Leave if you feel uncomfortable.',
        '- In danger, hold the red **SOS** button for one second. Also call ' + T('112') + '.'],
      next: ['app_start', 'app_sos', 'say_no']
    },
    toofan: {
      a: ['**Operation Toofan** is Kerala Police’s anti-narcotics campaign. It combines enforcement with awareness classes and counselling in schools and colleges, and now involves local bodies and community groups.',
        'SENTINEL was built for the **TOOFAN Hackathon (Prevention category)**. The bracelet and the SafeWalk app help people ask for help quickly and let police see alerts and routes.'],
      next: ['report', 'get_help', 'app_start']
    },
    app_start: {
      a: ['**Using SafeWalk:**',
        '- Log in with your SENTINAL account.',
        '- Choose how long your walk will take, and add a destination (optional).',
        '- Tap **Start Safe Journey**. The police dashboard is notified and your route is shared live.',
        '- Tap **I’ve arrived safely** when you get there. Need more time? Tap **+10 minutes**.',
        '- If you don’t confirm arrival in time, an alert goes to police automatically.',
        'Allow location access, and keep the screen on, for the best tracking.'],
      next: ['app_sos', 'app_trip', 'app_install']
    },
    app_sos: {
      a: ['**SOS:** during a journey, **hold the red button for one second**. SafeWalk sends an alert and your live location to the police dashboard and emails you a confirmation. You’ll see when police acknowledge it.',
        'The **SENTINEL bracelet** can also raise an alert with its touch sensor.',
        'This is a prototype and does not replace emergency services. In danger, always call ' + T('112') + ' as well.'],
      next: ['app_start', 'safe_tips']
    },
    app_trip: {
      a: ['**Plan a trip for later:**',
        '- On the home screen, find **Plan a trip for later**.',
        '- Choose when you will leave, how long it should take, and where you’re going.',
        '- At that time you get a notification (if you allowed it) and an email.',
        '- Open SafeWalk and tap **Start now**. Tracking begins only when you start.'],
      next: [{ t: 'Open trip planner', act: 'trips' }, 'app_start', 'app_install']
    },
    app_install: {
      a: ['**Install SafeWalk as an app:**',
        '- **Android (Chrome):** tap the **Install SafeWalk app** button on the home screen, or menu ⋮ then **Install app**.',
        '- **iPhone (Safari):** tap Share, then **Add to Home Screen**.'],
      next: ['app_start', 'app_trip']
    },
    privacy: {
      a: ['This chat runs inside your browser. Your messages are not saved or sent to any server, and they disappear when you close or refresh the app.',
        'I’m an awareness assistant, not a doctor, counsellor or police officer.'],
      next: MAIN
    },
    thanks: {
      a: ['You’re welcome! Stay safe, and remember you can always come back. If you or someone you know needs help, call ' + T('14416') + ' or ' + T('1933') + '.'],
      next: ['get_help', 'safe_tips']
    },
    bye: { a: ['Goodbye! Stay safe out there.'], next: [] },
    refuse: {
      a: ['I can’t help with how to make, buy, use or dose drugs. That could put you or someone else in danger.',
        'I can help with the risks, how to say no, getting help to stop, or helping a friend. If you’re worried about something that was taken, call ' + T('112') + ' or ' + T('108') + ' now.'],
      next: ['say_no', 'quit', 'get_help', 'overdose']
    },
    crisis_self: {
      a: ['I’m really sorry you’re going through this. You matter, and you don’t have to handle it alone.',
        '**Please reach out right now:** Tele-MANAS ' + T('14416') + ' (free counselling) or ' + T('112') + ' if you are in immediate danger.',
        'If you can, tell someone near you, like a family member, friend or teacher, and stay with them. If you have already taken something harmful, call ' + T('112') + ' or ' + T('108') + ' straight away.'],
      next: []
    },
    fallback: {
      a: ['I’m not sure I understood that. I can talk about drug prevention, getting help, staying safe, and using SafeWalk. Try one of these:'],
      next: MAIN
    }
  };

  // ---------------------------------------------------------------- intent matching
  // [regex, weight]; score = sum of weights of matching patterns. Earlier intents win ties.
  var INTENTS = [
    ['greet', [[/^ ?(hi|hii+|hello|hey|namaste|hola|good (morning|afternoon|evening))\b/, 3]]],
    ['bye', [[/\bbye\b|goodbye|see you|good night/, 3]]],
    ['thanks', [[/\bthank|\bthanks\b|\bthx\b|helpful|awesome/, 2]]],
    ['about', [[/who are you|what are you|what can you do|your name|about you/, 3], [/^ ?(help|menu|topics|options) ?$/, 3]]],
    ['types', [[/types? of (drugs?|substances?)|common (drugs?|substances?)|which drugs|kinds of drugs|list of drugs|drug types/, 3]]],
    ['withdrawal', [[/withdrawal|detox|cold turkey|stop suddenly|quit suddenly|the shakes/, 3]]],
    ['quit', [[/\bquit|stop using|want to stop|how (can|do|to) (i )?stop|cut down|give up|giving up|recover|recovery|relapse/, 3]]],
    ['cannabis', [[/cannabis|marijuana|\bweed\b|ganja|charas|bhang|hashish|\bhash\b|\bpot\b/, 3]]],
    ['tobacco', [[/tobacco|cigarette|smoking|\bsmoke\b|vape|vaping|nicotine|e ?cig|gutkha?|pan masala|hookah|\bbidi\b/, 3]]],
    ['opioids', [[/opioid|heroin|brown sugar|smack|morphine|tramadol|codeine|cough syrup|fentanyl|opium/, 3]]],
    ['party', [[/cocaine|\bmeth\b|methamphetamine|amphetamine|crystal|mdma|ecstasy|molly|\blsd\b|mephedrone|party drugs?|synthetic|stimulant|ketamine/, 3]]],
    ['inhalants', [[/inhalant|\bglue\b|thinner|sniff|correction fluid|whitener|petrol|solvent/, 3]]],
    ['prescription', [[/prescription|sleeping pills?|sedative|benzo|alprazolam|painkillers?|pain killers?|anxiety (pills?|tablets?)|\bpills?\b|\btablets?\b/, 2]]],
    ['alcohol', [[/alcohol|liquor|\bbeer\b|booze|\bwine\b|toddy|whisky|vodka|\brum\b|drinking/, 3]]],
    ['overdose', [[/overdose|what to do if (someone|he|she|a friend)/, 3]]],
    ['help_friend', [[/help (a |my |the )?(friend|brother|sister|son|daughter|child|kid|boyfriend|girlfriend|cousin|someone|him|her)/, 3], [/(friend|brother|sister|son|daughter|cousin) (is|uses|takes|on|has)/, 2]]],
    ['signs', [[/\bsigns?\b|symptoms?|how (do|can|to) (i )?(know|tell|find out)|suspect|behaviou?r|notice/, 2], [/using drugs/, 1]]],
    ['parents', [[/parents?|teachers?|school|educators?|guardian|talk to (my )?(kids?|children|students)/, 2]]],
    ['say_no', [[/say no|refuse|peer pressure|pressur|offered|offering|forcing|pushing me|force me|\bdare\b|convince me|insist/, 3]]],
    ['why_start', [[/why (do|did|would) (people|teens|teenagers|students|youth|youngsters|kids)|reasons?|risk factors?|start using|curiosity|causes? of/, 3]]],
    ['what_is', [[/what (is|are) (a |an )?(drug|drugs|substance|addiction|drug abuse|substance abuse)|drug abuse|substance (abuse|misuse|use)|addiction|meaning of/, 2]]],
    ['legal', [[/legal|\blaw\b|illegal|ndps|arrest|\bjail\b|punish|crime|police case|caught|sentence/, 3]]],
    ['report', [[/\breport|tip off|\btip\b|seller|dealer|peddler|selling|sells|complain|informant|trafficking/, 3]]],
    ['myths', [[/myths?|\bfacts?\b|true or false|just once|only once|harmless|natural|everyone does|is it (bad|safe|harmful|okay|ok)/, 3]]],
    ['get_help', [[/helpline|hotline|help line|toll free|phone number|contact number|numbers?\b/, 3], [/rehab|de ?addiction|treatment|counsel|clinic|hospital|doctor/, 2], [/(need|get|find|seek|ask for) help|where (can|do|to) (i |we )?(get|find)( help)?/, 4]]],
    ['stress', [[/stress|anxious|anxiety|depress|\bsad\b|lonely|loneliness|bored|boredom|\bexams?\b|coping|\bcope\b|mental health|overwhelm|\bpanic\b|worried|feeling low|burnout/, 3]]],
    ['app_trip', [[/schedul|plan(ned|ning)? (a )?(trip|journey|walk)|travel later|reminder|trip for later|later trip|book (a )?(trip|journey)|upcoming trip/, 3]]],
    ['app_sos', [[/\bsos\b|panic button|emergency button|alert (the )?police|bracelet|smart ?watch|sentinel|sentinal|touch sensor|dashboard/, 3]]],
    ['app_install', [[/install|home screen|add to home|offline|\bpwa\b|download (the )?app/, 3]]],
    ['app_start', [[/safe ?walk|journey|how (do|to|can) i use|arrived|arrival|extend|tracking|live location|\broute\b/, 3]]],
    ['toofan', [[/toofan|operation|hackathon|campaign|nasha mukt|kerala police/, 3]]],
    ['privacy', [[/privacy|private|confidential|saved|stored|recorded|\bdata\b|who can see/, 3]]],
    ['safe_tips', [[/safe(ty)? tips?|stay safe|walking|walk home|\balone\b|at night|stranger|spiked|spiking|laced|drugged|something in my drink|put something in|uncomfortable|followed|following me|\blift\b|\bparty\b|parties|unsafe|protect myself/, 3]]]
  ];

  var RX_SELF = /suicid|kill myself|end my life|end it all|want to die|wanna die|self harm|hurt myself|no reason to live|better off dead/;
  var RX_MEDICAL = /overdos|not breathing|stopped breathing|unconscious|can ?t wake|collapsed|took too (much|many)|foaming|seizure|passed out|blue lips/;
  var RX_DRUGWORD = /\bdrugs?\b|weed|ganja|cannabis|cocaine|\bmeth\b|heroin|\blsd\b|mdma|opioids?|marijuana|charas|brown sugar|mephedrone|ecstasy|\bcrack\b|tramadol|ketamine|\bhigh\b/;
  var RX_HOWTO = /how (to|do i|can i|much)|where (to|can i|do i)|best way|recipe|dosage|\bdose\b|make (it|some)|\b(buy|score|order|cook|brew|synthesi[sz]e|manufacture|grow|inject|snort|smoke)\b/;
  var RX_HELPY = /help|quit|stop|avoid|prevent|safe|recover|treat|report|say no|refuse|signs?|symptoms?|effects?|risk|danger|harm|law|legal/;

  function norm(s) {
    return ' ' + String(s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  }

  function match(text) {
    var t = norm(text);
    if (RX_SELF.test(t)) return 'crisis_self';
    if (RX_MEDICAL.test(t)) return 'overdose';
    if (RX_DRUGWORD.test(t) && RX_HOWTO.test(t) && !RX_HELPY.test(t)) return 'refuse';
    var best = 'fallback', top = 0;
    INTENTS.forEach(function (it) {
      var s = 0;
      it[1].forEach(function (p) { if (p[0].test(t)) s += p[1]; });
      if (s > top) { top = s; best = it[0]; }
    });
    return best;
  }

  // ---------------------------------------------------------------- DOM
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function inline(parent, s) {
    var re = /\*\*(.+?)\*\*|\{tel:([0-9+]+)\|([^}]+)\}/g, last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      if (m[1] !== undefined) { var sg = el('strong'); inline(sg, m[1]); parent.appendChild(sg); }
      else { var a = el('a', '', m[3]); a.href = 'tel:' + m[2]; parent.appendChild(a); }
      last = re.lastIndex;
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
  }
  function renderLines(box, lines) {
    var ul = null;
    lines.forEach(function (l) {
      if (l.indexOf('- ') === 0) {
        if (!ul) { ul = el('ul'); box.appendChild(ul); }
        var li = el('li'); inline(li, l.slice(2)); ul.appendChild(li);
      } else {
        ul = null;
        var p = el('p'); inline(p, l); box.appendChild(p);
      }
    });
  }

  var fab, panel, log, input, chipsBox = null, started = false, lastFocus = null, busy = false;

  function build() {
    var st = el('style'); st.textContent = CSS; document.head.appendChild(st);

    fab = el('button', 'sc-fab');
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Open SENTINAL Assistant chat');
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/><circle cx="9" cy="12" r=".6"/><circle cx="12.5" cy="12" r=".6"/><circle cx="16" cy="12" r=".6"/></svg>';

    panel = el('section', 'sc-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'SENTINAL Assistant chat');

    var head = el('div', 'sc-head');
    var ttl = el('div');
    ttl.appendChild(el('b', '', 'SENTINAL Assistant'));
    ttl.appendChild(el('span', '', 'Drug-prevention awareness'));
    var x = el('button', 'sc-x', '×');
    x.type = 'button'; x.setAttribute('aria-label', 'Close chat');
    head.appendChild(ttl); head.appendChild(x);

    var sos = el('div', 'sc-sos');
    var sl = el('span', '', 'Emergency?'); sl.style.flex = '1'; sos.appendChild(sl);
    [['112', '112'], ['108', '108']].forEach(function (n) {
      var a = el('a', '', 'Call ' + n[1]); a.href = 'tel:' + n[0]; sos.appendChild(a);
    });

    log = el('div', 'sc-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');

    var form = el('form', 'sc-form');
    input = el('input');
    input.type = 'text'; input.maxLength = 300; input.autocomplete = 'off';
    input.placeholder = 'Ask about drugs, help, or SafeWalk...';
    input.setAttribute('aria-label', 'Type your question');
    var send = el('button', 'sc-send');
    send.type = 'submit'; send.setAttribute('aria-label', 'Send');
    send.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
    form.appendChild(input); form.appendChild(send);

    var note = el('div', 'sc-note', 'Awareness only. Not medical or legal advice. Chat is not saved.');

    panel.appendChild(head); panel.appendChild(sos); panel.appendChild(log); panel.appendChild(form); panel.appendChild(note);
    document.body.appendChild(fab); document.body.appendChild(panel);

    fab.onclick = open;
    x.onclick = close;
    form.onsubmit = function (e) { e.preventDefault(); var v = input.value.trim(); if (!v || busy) return; input.value = ''; ask(v); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) close(); });
  }

  function open() {
    lastFocus = document.activeElement;
    panel.classList.add('open'); fab.hidden = true; document.body.classList.add('sc-lock');
    if (!started) { started = true; reply('greet'); }
    setTimeout(function () { input.focus(); scroll(); }, 50);
  }
  function close() {
    panel.classList.remove('open'); fab.hidden = false; document.body.classList.remove('sc-lock');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} } else fab.focus();
  }
  function scroll() { log.scrollTop = log.scrollHeight; }

  function addMsg(cls, lines) {
    var m = el('div', 'sc-m ' + cls);
    renderLines(m, lines);
    log.appendChild(m); scroll();
    return m;
  }
  function clearChips() { if (chipsBox && chipsBox.parentNode) chipsBox.parentNode.removeChild(chipsBox); chipsBox = null; }
  function addChips(list) {
    clearChips();
    if (!list || !list.length) return;
    chipsBox = el('div', 'sc-chips');
    list.forEach(function (c) {
      var o = typeof c === 'string' ? { t: LABEL[c], id: c } : c;
      var b = el('button', 'sc-chip' + (o.act ? ' act' : ''), o.t);
      b.type = 'button';
      b.onclick = function () {
        if (busy) return;
        if (o.act === 'trips') { openTrips(); return; }
        addMsg('sc-me', [o.t]); clearChips(); reply(o.id);
      };
      chipsBox.appendChild(b);
    });
    log.appendChild(chipsBox); scroll();
  }

  function reply(id) {
    var k = KB[id] || KB.fallback;
    busy = true; clearChips();
    var dots = el('div', 'sc-typing'); dots.setAttribute('aria-hidden', 'true');
    dots.appendChild(el('i')); dots.appendChild(el('i')); dots.appendChild(el('i'));
    log.appendChild(dots); scroll();
    setTimeout(function () {
      if (dots.parentNode) dots.parentNode.removeChild(dots);
      addMsg('sc-bot', k.a);
      addChips(k.next);
      busy = false;
    }, 450);
  }

  function ask(text) {
    addMsg('sc-me', [text]);
    reply(match(text));
  }

  function openTrips() {
    close();
    var c = document.getElementById('tripCard');
    if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (window.toast) window.toast('Log in, then open the home screen to plan a trip.');
  }

  // ---------------------------------------------------------------- boot
  window.SentinalChat = { open: open, close: close, match: match, ask: ask };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
