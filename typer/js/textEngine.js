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
  displayText(item, text = item.rawText || '') {
    return item.style.uppercase ? text.toLocaleUpperCase('uk') : text;
  },
  contourCenters: new WeakMap(),
  contourCenter(item) {
    const contour = item.contour;
    if (!contour) return { x: item.w / 2, y: item.h / 2 };
    let center = this.contourCenters.get(contour);
    if (center) return center;
    let weight = 0;
    let x = 0;
    let y = 0;
    contour.rows.forEach(([left, right], index) => {
      const area = (right - left) ** 2;
      weight += area;
      x += area * (left + right) / 2;
      y += area * (index + 0.5) * contour.step;
    });
    center = weight ? {
      x: x / weight,
      y: Math.max(item.h * 0.38, Math.min(item.h * 0.62, y / weight))
    } : { x: item.w / 2, y: item.h / 2 };
    this.contourCenters.set(contour, center);
    return center;
  },
  textCenter(item) {
    return this.contourCenter(item).x;
  },
  fontLimits(item) {
    if(item.autoFontLimits===false) {
      const minFont=Math.max(1,Number(item.manualMinFont)||24);
      return {minFont,maxFont:Math.max(minFont,Number(item.manualMaxFont)||68)};
    }
    const ctx=this.ctx ||= document.createElement('canvas').getContext('2d');
    ctx.font=this.font(item,100);
    const length=Math.max(1,ctx.measureText((this.displayText(item)||'Ні!').replace(/\s+/g,' ')).width/100);
    const estimate=Math.sqrt(item.w*item.h*.48/(length*Math.max(1.1,item.style.lineHeight||1.2)));
    const maxFont=Math.max(2,Math.round(Math.min(Math.min(item.w,item.h)*.46,estimate*1.45)));
    return {minFont:Math.max(1,Math.round(maxFont*.48)),maxFont};
  },
  // Shared by fitting and rendering: centre visible ink, not font advance boxes.
  placements(ctx,item,lines=item.lines,size=item.style.fontSize) {
    if (!lines?.length) return [];
    ctx.font=this.font(item,size);ctx.textAlign='center';ctx.textBaseline='middle';
    const lh=size*Math.max(1.1,item.style.lineHeight||1.2);
    const rows=lines.map((text,i)=>{
      text = this.displayText(item, text);
      const m=ctx.measureText(text),left=m.actualBoundingBoxLeft??m.width/2,right=m.actualBoundingBoxRight??m.width/2;
      return {text,x:(left-right)/2,y:(i-(lines.length-1)/2)*lh,
        ascent:m.actualBoundingBoxAscent??size*.5,descent:m.actualBoundingBoxDescent??size*.5,width:left+right};
    });
    const top=Math.min(...rows.map(r=>r.y-r.ascent)),bottom=Math.max(...rows.map(r=>r.y+r.descent));
    const center = this.contourCenter(item);
    const maxWidth = Math.max(...rows.map(r => r.width));
    const align = item.style.textAlign === 'left' ? -1 : item.style.textAlign === 'right' ? 1 : 0;
    rows.forEach(r => {
      r.y += center.y - item.h / 2 - (top + bottom) / 2;
      r.centerOffset = align * (maxWidth - r.width) / 2;
      r.x += center.x - item.w / 2 + r.centerOffset;
    });
    return rows;
  },
  inkMargin(item, size) {
    const style = item.style;
    return (style.strokeWidth || 0) * (style.strokeRelative ? size / 100 : 1) / 2 +
      (style.glowBlur || 0) * 2;
  },
  // Intersect every contour interval crossed by the height of a line.
  contourBand(item, top, bottom, pad) {
    if (top < pad || bottom > item.h - pad) return null;
    const { rows, step } = item.contour;
    let left = 0;
    let right = item.w;
    for (let i = Math.max(0, Math.floor((top - pad) / step));
      i <= Math.min(rows.length - 1, Math.ceil((bottom + pad) / step)); i++) {
      left = Math.max(left, rows[i][0]);
      right = Math.min(right, rows[i][1]);
    }
    return right - left > 2 * pad ? [left + pad, right - pad] : null;
  },
  capacity(item, top, bottom, pad, center = this.textCenter(item)) {
    if (top < pad || bottom > item.h - pad) return 0;
    if (item.contour) {
      const band = this.contourBand(item, top, bottom, pad);
      return band ? 2 * Math.max(0, Math.min(center - band[0], band[1] - center)) : 0;
    }
    let half = Math.min(center, item.w - center) - pad;
    if (item.type === 'bubble') {
      const ry = item.h / 2 - pad;
      const rx = item.w / 2 - pad;
      const dy = Math.max(Math.abs(top - item.h / 2), Math.abs(bottom - item.h / 2));
      half = Math.min(half, rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) - Math.abs(center - item.w / 2));
    }
    return Math.max(0, half * 2);
  },
  prepareText(text, hyphens) {
    const words = text.trim().replace(/\r\n?/g, '\n').replace(/\n+/g, '\n')
      .split(/[^\S\u00a0\n]+|(?=\n)|(?<=\n)/u).filter(Boolean);
    const breaks = words.map(word => hyphens ? this.breaks(word) : []);
    const paragraphs = words.filter(word => word === '\n').length;
    return { words, breaks, paragraphs, plain: words.filter(word => word !== '\n').join(' ') };
  },
  solve(item,size,pad,hyphens, prepared = this.prepareText(item.rawText, hyphens)) {
    const ctx=this.ctx ||= document.createElement('canvas').getContext('2d');
    ctx.font=this.font(item,size); ctx.textAlign='center';ctx.textBaseline='middle';
    const { words, breaks, paragraphs, plain } = prepared;
    const lh = size * Math.max(1.1, item.style.lineHeight || 1.2);
    const extra = this.inkMargin(item, size);
    const measure = new Map();
    const metrics = text => {
      let result = measure.get(text);
      if (!result) {
        const m = ctx.measureText(this.displayText(item, text));
        result = { w: 2 * Math.max(m.width / 2, m.actualBoundingBoxLeft || 0, m.actualBoundingBoxRight || 0) + 2 * extra,
          a: Math.max(size * .55, m.actualBoundingBoxAscent || 0) + extra,
          d: Math.max(size * .55, m.actualBoundingBoxDescent || 0) + extra };
        measure.set(text, result);
      }
      return result;
    };
    const center = this.contourCenter(item);
    const widthAt = (top, bottom) => this.capacity(item, top, bottom, pad, center.x);
    const totalWidth = ctx.measureText(this.displayText(item, plain)).width;
    let best=null;
    const maxLines = Math.min(words.length - paragraphs + breaks.filter(offsets => offsets.length).length,
      Math.floor((item.h - 2 * pad) / lh), 40);
    for(let n=paragraphs+1;n<=maxLines;n++) {
      const profile=Array.from({length:n},(_,i)=>n===1?1:n===2?(i===0?1:.72):
        .48+.52*Math.sqrt(Math.max(0,1-((i/(n-1)-.32)/.68)**2)));
      const baselines = profile.map((_, row) => center.y + (row - (n - 1) / 2) * lh);
      const bandWidths = item.contour && baselines.map(y => widthAt(y - size * .55, y + size * .55));
      const widest = bandWidths ? Math.max(...bandWidths) : 0;
      if (widest) profile.forEach((shape, row) => {
        profile[row] = .35 * shape + .65 * bandWidths[row] / widest;
      });
      const unit=totalWidth/profile.reduce((a,b)=>a+b,0);
      const rowWidths = baselines.map(() => new Map());
      const memo=new Map();
      const visit=(wi,offset,row)=>{
        if(row===n) return wi===words.length?{cost:0,lines:[]}:null;
        if(wi>=words.length) return null;
        const key=`${wi}:${offset}:${row}`;if(memo.has(key))return memo.get(key);
        const y = baselines[row];
        const target=unit*profile[row];
        let line='',answer=null;
        const offer=(t,next,off,penalty)=>{
          const m = metrics(t);
          const bandKey = m.a + ':' + m.d;
          const widths = rowWidths[row];
          if (!widths.has(bandKey)) widths.set(bandKey, widthAt(y - m.a, y + m.d));
          const cap = widths.get(bandKey);
          if (m.w > cap || !cap) return;
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
          if(!(j===wi&&offset)) for(const b of breaks[j]) offer(prefix+word.slice(0,b)+'-',j,b,.07);
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
        const placed=this.placements(ctx,{ ...item, effectivePadding: pad },result.lines,size);
        const fits=placed.every(r=>r.width+2*extra<=this.capacity(item,item.h/2+r.y-r.ascent-extra,item.h/2+r.y+r.descent+extra,pad,center.x+r.centerOffset));
        const cost=result.cost/n;
        if(fits&&(!best||cost<best.cost))best={...result,cost,size,padding:pad};
      }
    }
    return best;
  },
  fitFixedSize(item, size) {
    const ctx = this.ctx ||= document.createElement('canvas').getContext('2d');
    ctx.font = this.font(item, size);
    const padding = item.autoPadding === false ? Math.max(0, item.padding ?? 0) : ctx.measureText('н').width;
    const hyphens = item.style.hyphenate !== false;
    const solution = this.solve(item, size, padding, hyphens) ||
      (item.autoPadding !== false && this.solve(item, size, padding * .45, hyphens));
    item.style.fontSize = size;
    item.effectivePadding = padding;
    if (solution) {
      item.effectivePadding = solution.padding;
      item.lines = solution.lines;
      item.layoutError = null;
      return true;
    }

    const width = item.w - 2 * padding - ((item.style.strokeWidth || 0) * (item.style.strokeRelative ? (item.style.fontSize || 42) / 100 : 1));
    item.lines = item.rawText.trim().split(/\r\n?|\n/).flatMap(paragraph => {
      const lines = [];
      let line = '';
      for (const word of paragraph.split(/[^\S\u00a0]+/).filter(Boolean)) {
        const next = line ? line + ' ' + word : word;
        if (line && ctx.measureText(this.displayText(item, next)).width > width) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      return [...lines, line];
    });
    item.layoutError = 'Текст може виходити за межі бабла при заданому кеглі.';
    return false;
  },
  autoFitText(item,options={}) {
    if (!item?.rawText?.trim()) {
      if (item) { item.lines = []; item.layoutError = null; }
      return true;
    }
    const fixed = item.fixedFontSize ?? options.fixedSize;
    if (fixed > 0) return this.fitFixedSize(item, fixed);
    const limits=this.fontLimits(item);
    const min=options.minFont??limits.minFont,max=options.maxFont??limits.maxFont;
    const hyphens = item.style.hyphenate !== false;
    const prepared = this.prepareText(item.rawText, hyphens);
    let solution=null, firstSize=null;
    for(let size=max;size>=Math.min(min,max);size-=Math.max(1,(max-min)/28)) {
      this.ctx ||= document.createElement('canvas').getContext('2d');this.ctx.font=this.font(item,size);
      const pad=item.autoPadding===false?Math.max(0,item.padding??0):this.ctx.measureText('н').width;
      let candidate=this.solve(item,size,pad,hyphens,prepared);
      if(candidate){
        firstSize ??= size;
        candidate.quality=candidate.cost + .22*(firstSize-size)/firstSize;
        if(!solution || candidate.quality<solution.quality)solution=candidate;
      }
      if(firstSize && size<=firstSize*.72)break;
    }
    // Compact automatic padding when standard spacing would cost substantial type size.
    if (item.autoPadding !== false && (!firstSize || firstSize < max * .8)) {
      for (let size = max; size >= Math.min(min, max) && (!firstSize || size >= firstSize * 1.2); size -= Math.max(1, (max - min) / 28)) {
        this.ctx.font = this.font(item, size);
        const compact = this.solve(item, size, this.ctx.measureText('н').width * .45, hyphens, prepared);
        if (compact) { solution = compact; break; }
      }
    }
    // Minimum font is a preference. Containment takes precedence; never emit an overflowing fallback.
    for(let size=Math.min(min,max)-.5;!solution&&size>=.25;size*=.88) {
      solution=this.solve(item,size,item.autoPadding === false ? Math.max(0, item.padding ?? 0) : size * .25,hyphens,prepared);
    }
    item.lines=solution?.lines||[];
    if (!solution) {
      this.fitFixedSize(item, Math.max(.25, Math.min(min, max)));
      item.layoutError = 'Текст не вміщується: збільште бабл або зменште відступ чи обведення.';
      return false;
    }
    item.layoutError = null;
    item.style.fontSize = solution.size;
    item.effectivePadding = solution.padding;
    return true;
  }
};
