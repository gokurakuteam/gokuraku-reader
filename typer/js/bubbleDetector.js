/* Distance transform adapted from ol тайпер; click-local contour detection. */
window.BubbleDetector = {
  computeDistanceTransform(mask, w, h) {
    const INF = 999999;
    const dist = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      dist[i] = mask[i] ? INF : 0;
    }

    // Прохід 1: Зверху-зліва вниз-вправо
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (dist[idx] > 0) {
          let d = dist[idx];
          if (x > 0) d = Math.min(d, dist[idx - 1] + 1);
          if (y > 0) d = Math.min(d, dist[idx - w] + 1);
          if (x > 0 && y > 0) d = Math.min(d, dist[idx - w - 1] + 1.414);
          if (x < w - 1 && y > 0) d = Math.min(d, dist[idx - w + 1] + 1.414);
          dist[idx] = d;
        }
      }
    }

    // Прохід 2: Знизу-справа вгору-вліво
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const idx = y * w + x;
        if (dist[idx] > 0) {
          let d = dist[idx];
          if (x < w - 1) d = Math.min(d, dist[idx + 1] + 1);
          if (y < h - 1) d = Math.min(d, dist[idx + w] + 1);
          if (x < w - 1 && y < h - 1) d = Math.min(d, dist[idx + w + 1] + 1.414);
          if (x > 0 && y < h - 1) d = Math.min(d, dist[idx + w - 1] + 1.414);
          dist[idx] = d;
        }
      }
    }

    return dist;
  },


};
Object.assign(window.BubbleDetector, {
  detect(page, x, y) {
    for (const radius of [0, 1, 3, 6]) {
      const result = this.detectAtThreshold(page,x,y,radius);
      if (result) return result;
    }
    return null;
  },
  detectAtThreshold(page, x, y, barrierRadius) {
    if (!page?.cleanImg || x < 0 || y < 0 || x >= page.width || y >= page.height) return null;
    const scale = 0.5, radius = Math.max(1200, Math.min(3000, page.width * 2));
    const ox = Math.max(0, Math.floor(x-radius)), oy = Math.max(0, Math.floor(y-radius));
    const w = Math.ceil(Math.min(page.width-ox, 2*radius)*scale);
    const h = Math.ceil(Math.min(page.height-oy, 2*radius)*scale);
    const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(page.cleanImg, 0, 0, page.width, page.height, -ox*scale, -oy*scale, page.width*scale, page.height*scale);
    const data=ctx.getImageData(0,0,w,h).data;
    const sx=Math.floor((x-ox)*scale), sy=Math.floor((y-oy)*scale), seed=sy*w+sx;
    let blocked=Uint8Array.from({length:w*h},(_,i)=>Number(data[4*i+3]<=240 || Math.min(data[4*i],data[4*i+1],data[4*i+2])<185));
    if (barrierRadius) {
      const horizontal=new Uint8Array(w*h), vertical=new Uint8Array(w*h), r=barrierRadius;
      for(let y=0;y<h;y++) {
        let sum=0;
        for(let x=0;x<w+r;x++) {
          if(x<w)sum+=blocked[y*w+x];
          if(x>2*r)sum-=blocked[y*w+x-2*r-1];
          if(x>=r)horizontal[y*w+x-r]=Number(sum>0);
        }
      }
      for(let x=0;x<w;x++) {
        let sum=0;
        for(let y=0;y<h+r;y++) {
          if(y<h)sum+=horizontal[y*w+x];
          if(y>2*r)sum-=horizontal[(y-2*r-1)*w+x];
          if(y>=r)vertical[(y-r)*w+x]=Number(sum>0);
        }
      }
      blocked=vertical;
    }
    const bright=i=>!blocked[i];
    if (!bright(seed)) return null;
    const mask=new Uint8Array(w*h), queue=new Int32Array(w*h); let head=0,tail=1;queue[0]=seed;mask[seed]=1;
    while(head<tail) {
      const i=queue[head++], px=i%w,py=Math.floor(i/w);
      // Reject an unbounded background, including a region cut off by the analysis window.
      if(px===0 || py===0 || px===w-1 || py===h-1) return null;
      for(const n of [i-1,i+1,i-w,i+w]) if(!mask[n] && bright(n)){mask[n]=1;queue[tail++]=n;}
    }
    if(tail<80) return null;
    const dt=this.computeDistanceTransform(mask,w,h);
    // Ascend from the click, not the global peak: each lobe keeps its own centre.
    let peak=seed;
    for(let step=0;step<w+h;step++) {
      let next=peak;
      for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
        const px=peak%w+dx,py=Math.floor(peak/w)+dy;
        if(px>=0&&px<w&&py>=0&&py<h&&dt[py*w+px]>dt[next]) next=py*w+px;
      }
      if(next===peak) break; peak=next;
    }
    const cx=peak%w,cy=Math.floor(peak/w),r=dt[peak]; if(r<6) return null;
    const ray=(dx,dy)=>{let n=0;while(n<r*2.2&&mask[(cy+dy*n)*w+cx+dx*n]) n++;return n;};
    const rx=Math.min(ray(-1,0),ray(1,0)),ry=Math.min(ray(0,-1),ray(0,1));
    const left=Math.max(1,Math.ceil(cx-rx+1)),right=Math.min(w-2,Math.floor(cx+rx-1));
    const top=Math.max(1,Math.ceil(cy-ry+1)),bottom=Math.min(h-2,Math.floor(cy+ry-1));
    const rows=[];
    for(let py=top;py<=bottom;py++) {
      let l=cx,rr=cx;
      if(!mask[py*w+cx]) {rows.push([0,0]);continue;}
      while(l>left&&mask[py*w+l-1]) l--;
      while(rr<right&&mask[py*w+rr+1]) rr++;
      rows.push([(l-left)/scale,(rr-left)/scale]);
    }
    return {pageId:page.id,x:ox+left/scale,y:oy+top/scale,w:(right-left)/scale,h:(bottom-top+1)/scale,
      contour:{step:1/scale,rows},detected:true};
  }
});
