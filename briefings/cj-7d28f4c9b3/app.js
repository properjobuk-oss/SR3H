(() => {
  'use strict';
  const gallery=document.querySelector('.welcome-gallery');
  if(gallery){
    const slides=[...gallery.querySelectorAll('.welcome-slide')];
    const toggle=gallery.querySelector('.welcome-motion-toggle');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let paused=false,index=0;
    const apply=()=>{document.body.classList.toggle('welcome-paused',paused||reduced.matches);toggle.hidden=reduced.matches;toggle.setAttribute('aria-pressed',String(paused));toggle.textContent=paused?'Play motion':'Pause motion';};
    toggle.addEventListener('click',()=>{paused=!paused;apply();});
    reduced.addEventListener('change',apply);apply();
    setInterval(()=>{if(paused||reduced.matches||document.hidden)return;slides[index].classList.remove('is-current');slides[index].setAttribute('aria-hidden','true');index=(index+1)%slides.length;slides[index].classList.add('is-current');slides[index].removeAttribute('aria-hidden');},9000);
  }
  const demoPreview=document.querySelector('.home-demo-visual');
  if(demoPreview){
    const slides=[...demoPreview.querySelectorAll('.demo-preview-slide')];
    const controls=demoPreview.querySelector('.demo-example-controls');
    const buttons=[...controls.querySelectorAll('[data-demo-example]')];
    const toggle=controls.querySelector('.demo-rotation-toggle');
    const label=demoPreview.querySelector('#demo-example-label');
    const full=demoPreview.querySelector('.demo-full-view');
    const stage=demoPreview.querySelector('.demo-card-capture');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let index=0,visible=false,paused=false,timer;
    controls.hidden=false;
    const sync=()=>{
      demoPreview.classList.toggle('demo-screens-paused',paused||reduced.matches);
      toggle.hidden=reduced.matches;toggle.setAttribute('aria-pressed',String(paused));
      toggle.setAttribute('aria-label',paused?'Play screenshot rotation':'Pause screenshot rotation');
      toggle.firstElementChild.textContent=paused?'▷':'Ⅱ';
    };
    const select=(next,manual=false)=>{
      index=(next+slides.length)%slides.length;
      slides.forEach((slide,i)=>{const current=i===index;slide.classList.toggle('is-current',current);slide.setAttribute('aria-hidden',String(!current));slide.inert=!current;});
      buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
      label.textContent=slides[index].dataset.label;full.href=slides[index].getAttribute('href');
      full.setAttribute('aria-label',slides[index].getAttribute('aria-label'));
      if(manual){paused=true;sync();}
    };
    const restart=()=>{
      clearInterval(timer);if(!visible)return;
      timer=setInterval(()=>{
        if(paused||reduced.matches||document.hidden||document.body.classList.contains('welcome-paused')||demoPreview.contains(document.activeElement))return;
        if(matchMedia('(hover: hover)').matches&&demoPreview.matches(':hover'))return;
        select(index+1);
      },12000);
    };
    buttons.forEach((button,i)=>button.addEventListener('click',()=>{select(i,true);restart();}));
    controls.addEventListener('keydown',event=>{
      if(!event.target.matches('[data-demo-example]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?slides.length-1:Number(event.target.dataset.demoExample)+(event.key==='ArrowRight'?1:-1);
      select(next,true);buttons[index].focus();restart();
    });
    toggle.addEventListener('click',event=>{paused=!paused;sync();if(!paused&&event.detail>0)toggle.blur();restart();});
    demoPreview.addEventListener('focusout',restart);demoPreview.addEventListener('mouseleave',restart);
    if('IntersectionObserver' in window){new IntersectionObserver(items=>{visible=items[0].isIntersecting;restart();},{threshold:.2}).observe(demoPreview);}else{visible=true;restart();}
    const size=()=>stage.style.setProperty('--demo-frame-height',`${stage.getBoundingClientRect().height}px`);
    if('ResizeObserver' in window)new ResizeObserver(size).observe(stage);else addEventListener('resize',size);
    reduced.addEventListener('change',()=>{sync();restart();});size();sync();
  }
  if(document.body.classList.contains('welcome-page')){
    const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    const entries=[...document.querySelectorAll('.home-demo-copy,.home-connections-heading,.connections-landmark,.home-connection,.home-closing')];
    let observer;
    if('IntersectionObserver' in window){
      observer=new IntersectionObserver(items=>items.forEach(item=>{
        if(item.isIntersecting){item.target.classList.add('is-in-view');observer.unobserve(item.target);}
      }),{threshold:0.08});
      entries.forEach((element,index)=>{
        if(element.getBoundingClientRect().top>innerHeight&&!motionPreference.matches){
          element.classList.add('scroll-enter');
          if(element.classList.contains('home-connection'))element.style.setProperty('--enter-delay',`${[...document.querySelectorAll('.home-connection')].indexOf(element)*70}ms`);
          observer.observe(element);
        }
      });
    }
    const band=document.querySelector('.home-demo-band');
    let queued=false;
    const updateMotion=()=>{
      queued=false;if(!band)return;
      if(motionPreference.matches||document.body.classList.contains('welcome-paused')){
        band.style.removeProperty('--demo-scroll');band.style.removeProperty('--concept-angle');return;
      }
      const rect=band.getBoundingClientRect();
      if(rect.bottom<0||rect.top>innerHeight)return;
      const progress=Math.max(0,Math.min(1,(innerHeight-rect.top)/(innerHeight+rect.height)));
      const distance=innerWidth>760?20:8;
      band.style.setProperty('--demo-scroll',`${((progress-.5)*distance).toFixed(2)}px`);
      band.style.setProperty('--concept-angle',`${(-7+progress*3).toFixed(2)}deg`);
    };
    const queueMotion=()=>{if(!queued){queued=true;requestAnimationFrame(updateMotion);}};
    addEventListener('scroll',queueMotion,{passive:true});addEventListener('resize',queueMotion);
    document.querySelector('.welcome-motion-toggle')?.addEventListener('click',queueMotion);
    motionPreference.addEventListener('change',()=>{
      if(motionPreference.matches){entries.forEach(element=>element.classList.add('is-in-view'));observer?.disconnect();}
      queueMotion();
    });queueMotion();
  }
  const agendaPhotos=[...document.querySelectorAll('.agenda-editorial-photo')];
  if(agendaPhotos.length&&'IntersectionObserver' in window){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const observer=new IntersectionObserver(items=>items.forEach(item=>{
      if(item.isIntersecting){item.target.classList.add('photo-arrived');observer.unobserve(item.target);}
    }),{threshold:.1});
    agendaPhotos.forEach(photo=>{
      if(!reduced.matches&&photo.getBoundingClientRect().top>innerHeight){photo.classList.add('photo-waiting');observer.observe(photo);}
    });
    reduced.addEventListener('change',()=>{
      if(reduced.matches){agendaPhotos.forEach(photo=>photo.classList.add('photo-arrived'));observer.disconnect();}
    });
  }
  const clubPhoto=document.querySelector('.club-editorial');
  if(clubPhoto&&'IntersectionObserver' in window){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    if(!reduced.matches&&clubPhoto.getBoundingClientRect().top>innerHeight){
      clubPhoto.classList.add('club-waiting');
      const observer=new IntersectionObserver(items=>{
        if(items.some(item=>item.isIntersecting)){clubPhoto.classList.add('club-arrived');observer.disconnect();}
      },{threshold:.12});observer.observe(clubPhoto);
      reduced.addEventListener('change',()=>{if(reduced.matches){clubPhoto.classList.add('club-arrived');observer.disconnect();}});
    }
  }
  const readingKey='sr3h-chris-briefing-reading-v1';
  const returnKey='sr3h-chris-briefing-return-v1';
  const chapter=document.querySelector('[data-chapter]');
  try {
    if(chapter) localStorage.setItem(readingKey,chapter.dataset.chapter);
    const last=localStorage.getItem(readingKey);
    const resume=document.querySelector('#continue');
    if(resume && /^[1-6]$/.test(last||'')) {
      resume.href=`chapter-${last}.html`;
      resume.textContent=`Continue chapter ${last} →`;
      resume.hidden=false;
    }
  } catch (_) { /* Reading must also work when storage is unavailable. */ }
  document.querySelectorAll('a[data-term],a.note-link').forEach((a,i)=> {
    if(!a.id) a.id=`reading-link-${i}`;
    a.addEventListener('click',()=> {
      try {sessionStorage.setItem(returnKey,JSON.stringify({href:location.pathname+location.search+'#'+a.id,target:new URL(a.href).hash}));} catch (_) {}
    });
  });
  try {
    const saved=JSON.parse(sessionStorage.getItem(returnKey)||'null');
    if(saved && typeof saved.href==='string' && saved.href.startsWith('/') && !saved.href.startsWith('//') && saved.target===location.hash){
      const target=document.getElementById(location.hash.slice(1));
      const ret=target?.querySelector('.term-return,.note-return');
      if(ret){ret.href=saved.href;ret.textContent='← Return to your place';}
    }
  } catch (_) {}
  function revealTarget() {
    let id; try{id=decodeURIComponent(location.hash.slice(1));}catch(_){return;}
    if(!id)return;
    const target=document.getElementById(id);
    if(!target)return;
    let d=target.closest('details');
    while(d){d.open=true;d=d.parentElement?.closest('details');}
    if(target.classList.contains('source-note')) {
      const detail=target.querySelector('details');if(detail)detail.open=true;
    }
    requestAnimationFrame(()=>{
      target.scrollIntoView({block:'start',behavior:'instant'});
      target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
    });
  }
  revealTarget();
  window.addEventListener('hashchange',revealTarget);
  const simulation=document.querySelector('.simulation');
  if(simulation){
    const buttons=[...simulation.querySelectorAll('[data-step]')];
    const panels=[...simulation.querySelectorAll('[data-panel]')];
    const select=(i)=>{
      buttons.forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));
      panels.forEach((p,n)=>p.hidden=n!==i);
    };
    buttons.forEach((button,i)=>button.addEventListener('click',()=>select(i)));
    select(0);
  }
  const drawer=document.querySelector('.detail-drawer');
  const viewer=document.querySelector('.infographic-viewer');
  const transcript=document.querySelector('.reading-transcript');
  transcript?.addEventListener('toggle',()=>{
    if(!transcript.open)return;
    if(drawer?.open)drawer.close();
    requestAnimationFrame(()=>{
      const headerHeight=document.querySelector('.site-header')?.getBoundingClientRect().height||0;
      window.scrollTo({top:transcript.getBoundingClientRect().top+scrollY-headerHeight-16,behavior:'instant'});
    });
  });
  let detailTrigger=null,viewerTrigger=null;
  const showModal=(dialog)=>{dialog.showModal();document.documentElement.classList.add('modal-open');};
  const closed=()=>{if(!document.querySelector('dialog:modal'))document.documentElement.classList.remove('modal-open');};
  if(drawer){
    const markers=[...document.querySelectorAll('.graphic-experience .graphic-hotspot')];
    const sources=JSON.parse(document.querySelector('#chapter-sources')?.textContent||'[]');
    const heading=drawer.querySelector('#detail-title');
    const references=drawer.querySelector('.detail-references');
    const sourceCard=record=>{
      const card=document.createElement('article');card.className='panel-source-card';
      const metadata=document.createElement('p');metadata.className='source-metadata';metadata.textContent=`${record.publisher} · ${record.date}`;
      const title=document.createElement('h3');title.textContent=record.title;
      const actions=document.createElement('div');actions.className='panel-source-actions';
      if(record.url){const original=document.createElement('a');original.href=record.url;original.target='_blank';original.rel='noopener noreferrer';original.textContent='Original source ↗';actions.append(original);}
      const full=document.createElement('a');full.href=`notes.html#${record.id}`;full.textContent='Full note →';actions.append(full);
      card.append(title,metadata,actions);return card;
    };
    const showDetail=link=>{
      markers.forEach(marker=>{marker.classList.remove('is-selected');marker.setAttribute('aria-expanded','false');});
      link.classList.add('is-selected');link.setAttribute('aria-expanded','true');
      const target=document.getElementById(link.hash.slice(1));if(!target)return;
      detailTrigger=link;
      const wholeChapter=target.classList.contains('reading-transcript');
      const source=wholeChapter?target.querySelector('.chapter-content'):(target.closest('.concept-card')||target);
      const accent=[...source.classList].find(name=>name.startsWith('accent-'));
      let tone=accent?['blue','mint','purple'][Number(accent.slice(-1))]:'blue';
      if(target.id==='dataset-revenue')tone='amber';
      if(target.id==='dataset-investment')tone='mint';
      if(chapter?.dataset.chapter==='6'&&accent)tone=['purple','blue','mint'][Number(accent.slice(-1))];
      drawer.dataset.tone=tone;
      const copy=source.cloneNode(true);
      const noteIds=[...copy.querySelectorAll('.note-link')].map(a=>a.hash.slice(1));
      copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
      copy.querySelectorAll('details').forEach(el=>el.open=true);
      copy.querySelectorAll('.sim-step').forEach(el=>el.hidden=false);
      copy.querySelectorAll('.back-link,.chapter-art,.chapter-reference-links,.step-buttons,.concept-icon,.note-link').forEach(el=>el.remove());
      if(!wholeChapter){
        copy.querySelector('.section-caption')?.remove();
        if(copy.classList.contains('concept-card')){
          copy.querySelector(':scope>.eyebrow')?.remove();copy.querySelector(':scope>h3')?.remove();
          const lead=copy.querySelector(':scope>p');if(lead)lead.classList.add('panel-lead');
        }
      }
      const matching=sources.filter(record=>noteIds.includes(record.id));
      const relevant=wholeChapter?sources:matching;
      references.hidden=!relevant.length;references.open=false;
      drawer.querySelector('.panel-source-body').replaceChildren(...relevant.map(sourceCard));
      drawer.querySelector('.drawer-body').replaceChildren(copy);
      heading.textContent=link.dataset.detailLabel||'Detail';
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)drawer.querySelector('.drawer-body').animate([{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:140,easing:'ease-out'});
      drawer.querySelector('.panel-scroll').scrollTop=0;if(!drawer.open){drawer.show();document.documentElement.classList.add('details-open');}heading.focus({preventScroll:true});
    };
    document.querySelectorAll('.graphic-hotspot').forEach(link=>{
      link.setAttribute('aria-haspopup','dialog');link.setAttribute('aria-controls','graphic-detail');link.setAttribute('aria-expanded','false');
      link.addEventListener('click',event=>{event.preventDefault();showDetail(link);});
    });
    document.querySelector('.graphic-experience .graphic-canvas')?.addEventListener('click',event=>{
      if(!drawer.open)return;
      const region=event.target.closest('.graphic-region');
      if(region&&region!==detailTrigger)return;
      event.preventDefault();event.stopImmediatePropagation();drawer.close();
    },true);
    drawer.querySelector('[data-close-detail]').addEventListener('click',()=>drawer.close());
    drawer.addEventListener('close',()=>{document.documentElement.classList.remove('details-open');document.querySelectorAll('[aria-controls="graphic-detail"]').forEach(link=>{link.classList.remove('is-selected');link.setAttribute('aria-expanded','false');});closed();detailTrigger?.focus({preventScroll:true});});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drawer.open&&!viewer?.open){event.preventDefault();drawer.close();}});
    drawer.addEventListener('click',event=>{if(event.target===drawer){const r=drawer.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)drawer.close();}});
  }
  if(viewer){
    const trigger=document.querySelector('[data-enlarge]');
    const viewport=viewer.querySelector('.viewer-viewport');
    const image=viewport.querySelector('img');
    let zoom=1;
    const renderZoom=()=>{
      image.style.width=`${Math.round(viewport.clientWidth*zoom)}px`;
      viewer.querySelector('.zoom-status').textContent=`${Math.round(zoom*100)}%`;
      viewer.querySelector('[data-zoom="out"]').disabled=zoom<=1;
      viewer.querySelector('[data-zoom="in"]').disabled=zoom>=4;
    };
    trigger?.addEventListener('click',event=>{
      event.preventDefault();viewerTrigger=trigger;
      const original=document.querySelector('.chapter-infographic');
      image.src=original.src;image.alt=original.alt;
      viewer.querySelector('#viewer-title').textContent=document.querySelector('.graphic-actions [data-detail-label]').dataset.detailLabel;
      zoom=1;showModal(viewer);renderZoom();viewport.scrollTo(0,0);viewer.querySelector('[data-close-viewer]').focus();
    });
    viewer.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{
      const action=button.dataset.zoom;
      zoom=action==='fit'?1:Math.max(1,Math.min(4,zoom+(action==='in'?.5:-.5)));
      renderZoom();if(action==='fit')viewport.scrollTo(0,0);
    }));
    viewer.querySelector('[data-close-viewer]').addEventListener('click',()=>viewer.close());
    viewer.addEventListener('close',()=>{closed();viewerTrigger?.focus({preventScroll:true});});
    window.addEventListener('resize',()=>{if(viewer.open)renderZoom();});
  }
  const swipeCanvas=document.querySelector('.graphic-experience .graphic-canvas');
  if(swipeCanvas){
    const chapterLinks=[...document.querySelectorAll('.chapter-nav a')];
    const current=chapterLinks.findIndex(link=>link.hasAttribute('aria-current'));
    let gesture=null,swipedAt=-Infinity;
    swipeCanvas.addEventListener('pointerdown',event=>{
      if(event.pointerType!=='touch')return;
      if(gesture){gesture=null;return;}
      if(!event.isPrimary||drawer?.open||viewer?.open||event.clientX<24||event.clientX>innerWidth-24)return;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now()};
    });
    swipeCanvas.addEventListener('pointercancel',()=>{gesture=null;});
    swipeCanvas.addEventListener('pointerup',event=>{
      const start=gesture;gesture=null;
      if(!start||start.id!==event.pointerId||drawer?.open||viewer?.open)return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y;
      if(Math.abs(dx)<Math.max(65,swipeCanvas.clientWidth*.16)||Math.abs(dx)<Math.abs(dy)*1.7||performance.now()-start.time>1000)return;
      const next=chapterLinks[current+(dx<0?1:-1)];
      swipedAt=performance.now();event.preventDefault();
      if(next)location.assign(next.href);
    });
    swipeCanvas.addEventListener('click',event=>{if(performance.now()-swipedAt<500){event.preventDefault();event.stopImmediatePropagation();}},true);
  }
  window.addEventListener('beforeprint',()=>document.querySelectorAll('details').forEach(d=>{d.dataset.wasOpen=String(d.open);d.open=true;}));
  window.addEventListener('afterprint',()=>document.querySelectorAll('details').forEach(d=>{d.open=d.dataset.wasOpen==='true';}));
  // Generated from the final PDF's actual byte count; never an estimated display value.
  fetch('pdf-meta.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(meta=>{
    if(!meta||!Number.isFinite(meta.bytes))return;
    const size=meta.bytes<1048576?`${Math.ceil(meta.bytes/1024)} KB`:`${(meta.bytes/1048576).toFixed(1)} MB`;
    document.querySelectorAll('[data-pdf-size]').forEach(el=>{el.textContent=`PDF · ${size}`;el.title=`${meta.bytes.toLocaleString()} bytes · v${meta.version} · ${meta.exportDate}`;});
  }).catch(()=>{});
})();
