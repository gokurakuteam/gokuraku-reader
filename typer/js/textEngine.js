/* Contour-constrained dynamic line breaking. rawText is never modified. */
window.TextEngine = {
  hyphenator: createHyphenator(hyphenationPatternsUk, {hyphenChar:'\u00ad', minWordLength:4}),
  breaks(word) {
    // Punctuation belongs to the token, but must not disable word hyphenation.
    // Keep offsets in the original token so quotes and final punctuation survive.
    const match=word.match(/^([«„“"(\[]*)([А-ЯІЇЄҐа-яіїєґ’'ʼ]+)([.!?…,:;»”")\]]*)$/u);
    if(!match)return [];
    const [,prefix,core]=match;
    const normalized=core.replace(/[’ʼ]/g,"'");
    const pieces=this.hyphenator(normalized).split('\u00ad');
    let pos=0; const result=[];
    for(const p of pieces.slice(0,-1)) {
      pos+=p.length;
      if(pos>=2 && core.length-pos>=2 && !/[ьй’'ʼ]/i.test(core[pos]) &&
        !/[’'ʼ]/.test(core[pos-1]) && !/^(дж|дз)$/i.test(core.slice(pos-1,pos+1)) &&
        /[аеєиіїоуюя]/i.test(core.slice(0,pos)) && /[аеєиіїоуюя]/i.test(core.slice(pos))) result.push(prefix.length+pos);
    }
    return result;
  },
  font(item,size) {const s=item.style;return `${s.italic?'italic ':''}${s.bold?'bold ':''}${size}px "${s.fontFamily||'Arial'}"`;},
  fontLimits(item) {
    if(item.autoFontLimits===false) {
      const minFont=Math.max(1,Number(item.manualMinFont)||24);
      return {minFont,maxFont:Math.max(minFont,Number(item.manualMaxFont)||68)};
    }
    const ctx=this.ctx ||= document.createElement('canvas').getContext('2d');
    ctx.font=this.font(item,100);
    const length=Math.max(1,ctx.measureText((item.rawText||'Ні!').replace(/\s+/g,' ')).width/100);
    const estimate=Math.sqrt(item.w*item.h*.48/(length*Math.max(1.1,item.style.lineHeight||1.2)));
    const maxFont=Math.max(2,Math.round(Math.min(Math.min(item.w,item.h)*.46,estimate*1.45)));
    return {minFont:Math.max(1,Math.round(maxFont*.48)),maxFont};
  },
  // Shared by fitting and rendering: centre visible ink, not font advance boxes.
  placements(ctx,item,lines=item.lines,size=item.style.fontSize) {
    ctx.font=this.font(item,size);ctx.textAlign='center';ctx.textBaseline='middle';
    const lh=size*Math.max(1.1,item.style.lineHeight||1.2);
    const rows=lines.map((text,i)=>{
      const m=ctx.measureText(text),left=m.actualBoundingBoxLeft??m.width/2,right=m.actualBoundingBoxRight??m.width/2;
      return {text,x:(left-right)/2,y:(i-(lines.length-1)/2)*lh,
        ascent:m.actualBoundingBoxAscent??size*.5,descent:m.actualBoundingBoxDescent??size*.5,width:left+right};
    });
    const top=Math.min(...rows.map(r=>r.y-r.ascent)),bottom=Math.max(...rows.map(r=>r.y+r.descent));
    rows.forEach(r=>r.y-=(top+bottom)/2);
    return rows;
  },
  // Available centred width for the ENTIRE ink band, not just its baseline.
  capacity(item,top,bottom,pad) {
    if(top<pad || bottom>item.h-pad) return 0;
    let half=item.w/2-pad;
    if(item.contour) {
      const {rows,step}=item.contour;
      for(let i=Math.max(0,Math.floor((top-pad)/step));i<=Math.min(rows.length-1,Math.ceil((bottom+pad)/step));i++)
        half=Math.min(half,item.w/2-rows[i][0]-pad,rows[i][1]-item.w/2-pad);
    } else if(item.type==='bubble') {
      const ry=item.h/2-pad,rx=item.w/2-pad;
      const dy=Math.max(Math.abs(top-item.h/2),Math.abs(bottom-item.h/2));
      half=Math.min(half,rx*Math.sqrt(Math.max(0,1-(dy/ry)**2)));
    }
    return Math.max(0,half*2);
  },
  solve(item,size,pad,hyphens) {
    const ctx=this.ctx ||= document.createElement('canvas').getContext('2d');
    ctx.font=this.font(item,size); ctx.textAlign='center';ctx.textBaseline='middle';
    const words=item.rawText.trim().replace(/\r\n?/g,'\n').replace(/\n+/g,'\n').split(/[^\S\u00a0\n]+|(?=\n)|(?<=\n)/u).filter(Boolean);
    const lh=size*Math.max(1.1,item.style.lineHeight||1.2);
    const extra=(item.style.strokeWidth||0)/2+(item.style.glowBlur||0)*2;
    const measure=new Map();
    const metrics=t=>{if(!measure.has(t)){const m=ctx.measureText(t);measure.set(t,{w:2*Math.max(m.width/2,m.actualBoundingBoxLeft||0,m.actualBoundingBoxRight||0)+2*extra,
      a:Math.max(size*.55,m.actualBoundingBoxAscent||0)+extra,d:Math.max(size*.55,m.actualBoundingBoxDescent||0)+extra});}return measure.get(t);};
    const totalWidth=ctx.measureText(words.filter(w=>w!=='\n').join(' ')).width;
    let best=null;
    const maxLines=Math.min(words.length*2,Math.floor((item.h-2*pad)/lh),40);
    for(let n=1;n<=maxLines;n++) {
      const profile=Array.from({length:n},(_,i)=>n===1?1:n===2?(i===0?1:.72):
        .48+.52*Math.sqrt(Math.max(0,1-((i/(n-1)-.32)/.68)**2)));
      const unit=totalWidth/profile.reduce((a,b)=>a+b,0);
      const memo=new Map();
      const visit=(wi,offset,row)=>{
        if(row===n) return wi===words.length?{cost:0,lines:[]}:null;
        if(wi>=words.length) return null;
        const key=`${wi}:${offset}:${row}`;if(memo.has(key))return memo.get(key);
        const y=item.h/2+(row-(n-1)/2)*lh;
        const target=unit*profile[row];
        let line='',answer=null;
        const offer=(t,next,off,penalty)=>{
          const m=metrics(t),cap=this.capacity(item,y-m.a,y+m.d,pad);if(m.w>cap || !cap) return;
          const rest=visit(next,off,row+1);if(!rest)return;
          // Avoid a narrow middle row between two wider rows, and a tiny
          // isolated word ending on the last row. Neither is an oval profile.
          const nextWidth=rest.lines.length?metrics(rest.lines[0]).w:0;
          const afterWidth=rest.lines.length>1?metrics(rest.lines[1]).w:0;
          const valley=afterWidth?Math.max(0,Math.min(m.w,afterWidth)-nextWidth)/Math.max(m.w,afterWidth):0;
          const shortEnding=row===n-1 && offset>0 && t.replace(/[^\p{L}]/gu,'').length<3 ? .5 : 0;
          const cost=rest.cost+3*((m.w-target)/Math.max(size,target))**2+penalty+1.5*valley**2+shortEnding;
          if(!answer||cost<answer.cost)answer={cost,lines:[t,...rest.lines]};
        };
        for(let j=wi;j<words.length;j++) {
          if(words[j]==='\n'){if(line)offer(line,j+1,0,0);break;}
          const word=words[j].slice(j===wi?offset:0),prefix=line?line+' ':'';
          if(hyphens && !(j===wi&&offset)) for(const b of this.breaks(word)) offer(prefix+word.slice(0,b)+'-',j,b,.07);
          line=prefix+word;
          const next=words[j+1]==='\n'?j+2:j+1;
          // Keep short prepositions/conjunctions with the following word when possible.
          offer(line,next,0,/^(і|й|в|у|з|із|зі|до|на|не|та|а)$/i.test(word)&&next<words.length?.4:0);
          if(metrics(line).w>item.w)break;
          if(next===j+2)break;
        }
        memo.set(key,answer);return answer;
      };
      const result=visit(0,0,0);
      if(result) {
        const placed=this.placements(ctx,item,result.lines,size);
        const fits=placed.every(r=>r.width+2*extra<=this.capacity(item,item.h/2+r.y-r.ascent-extra,item.h/2+r.y+r.descent+extra,pad));
        const cost=result.cost/n;
        if(fits&&(!best||cost<best.cost))best={...result,cost,size,padding:pad};
      }
    }
    return best;
  },
  autoFitText(item,options={}) {
    if(!item?.rawText?.trim()){if(item)item.lines=[];return true;}
    const limits=this.fontLimits(item);
    const min=options.minFont??limits.minFont,max=options.maxFont??limits.maxFont;
    let solution=null, firstSize=null;
    for(let size=max;size>=Math.min(min,max);size-=Math.max(1,(max-min)/28)) {
      this.ctx ||= document.createElement('canvas').getContext('2d');this.ctx.font=this.font(item,size);
      const pad=item.autoPadding===false?(item.padding??0):this.ctx.measureText('н').width;
      let candidate=this.solve(item,size,pad,item.style.hyphenate!==false);
      if(candidate){
        firstSize ??= size;
        candidate.quality=candidate.cost + .22*(firstSize-size)/firstSize;
        if(!solution || candidate.quality<solution.quality)solution=candidate;
      }
      if(firstSize && size<=firstSize*.72)break;
    }
    // Minimum font is a preference. Containment takes precedence; never emit an overflowing fallback.
    for(let size=Math.min(min,max)-.5;!solution&&size>=.25;size*=.88) {
      solution=this.solve(item,size,Math.min(item.padding??12,size*.35),item.style.hyphenate!==false);
    }
    item.lines=solution?.lines||[];
    item.layoutError=solution?null:'Текст не вміщується: збільште бабл або зменште обведення/сяйво.';
    if(solution){item.style.fontSize=solution.size;item.effectivePadding=solution.padding;item.textOffsetX=0;item.textOffsetY=0;}
    return !!solution;
  }
};
