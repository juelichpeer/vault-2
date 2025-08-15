export function $(q, el=document){ return el.querySelector(q); }
export function $all(q, el=document){ return [...el.querySelectorAll(q)]; }

export const toast = {
  el: null,
  show(msg, ms=2200){
    if(!this.el){ this.el = document.querySelector("#toast"); }
    this.el.textContent = msg;
    this.el.style.display = "block";
    clearTimeout(this._t);
    this._t = setTimeout(()=> this.hide(), ms);
  },
  hide(){ if(this.el) this.el.style.display = "none"; }
};

export const modal = {
  open(id){ const b = document.querySelector(id); if(b){ b.style.display="flex"; } },
  close(id){ const b = document.querySelector(id); if(b){ b.style.display="none"; } },
};
