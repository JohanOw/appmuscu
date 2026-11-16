param([string]$Dir,[string]$OutDir)
# Copie adaptee de bank/mascotte/carte-musculaire-colorize.ps1 (colorize3) pour AppMuscu v2.3.
# Produit, une seule fois et hors appli : 4 rendus uniformes (niveau 0 a 3) et une carte des zones (R = groupe*16+8, plus proche voisin).
# Carte musculaire v2 : zones = "anatome couleur 2", ombres et traits = "anatomy blanc", slip = "anatomy rouge".
$src = @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class MuscleMapPrep {
  // Groupes : 0 Pectoraux 1 Dorsaux 2 Quadriceps 3 Deltoides 4 Biceps 5 Triceps 6 Trapezes 7 Avant-bras 8 Ischios 9 Fessiers 10 Lombaires 11 Adducteurs 12 Abdos 13 Mollets
  // Palette : 0 non travaille (blanc grise), 1 cyan, 2 jaune, 3 rose
  static int[][] Pal = { new[]{205,208,232}, new[]{45,226,230}, new[]{255,209,102}, new[]{255,95,162} };
  // Couleurs de reference mesurees sur la carte (groupe, R, G, B)
  static int[][] Ref = {
    new[]{0,218,24,49}, new[]{3,251,227,2}, new[]{4,157,68,212}, new[]{7,224,31,127}, new[]{7,242,36,135},
    new[]{12,73,177,251}, new[]{6,3,179,159}, new[]{6,144,211,208}, new[]{11,17,152,130}, new[]{2,35,90,45},
    new[]{13,73,90,100}, new[]{1,31,71,132}, new[]{10,201,150,125}, new[]{5,227,102,21}, new[]{8,133,30,69} };
  static byte[] Load(string p,out int w,out int h){ using(var b=new Bitmap(p)){ w=b.Width;h=b.Height; var d=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb); var a=new byte[w*h*4]; Marshal.Copy(d.Scan0,a,0,a.Length); b.UnlockBits(d); return a; } }
  static bool Green(byte[] a,int i){ int b=a[i],g=a[i+1],r=a[i+2]; return g>150 && g>r+60 && g>b+60; }
  // -2 fond, -1 garder l'image blanche, -5 slip, >=0 groupe
  static int Classify(byte[] m,int i,double u,double v){
    int b=m[i],g=m[i+1],r=m[i+2];
    int mx=Math.Max(r,Math.Max(g,b)), mn=Math.Min(r,Math.Min(g,b));
    bool back = u>0.5;
    bool briefs = back ? (u>0.665&&u<0.855&&v>0.48&&v<0.63) : (u>0.165&&u<0.338&&v>0.48&&v<0.64);
    if(briefs && mx-mn<45 && mx>100) return -5;                // slip (blanc ou gris sur la carte)
    if(mn>215 && mx-mn<25) return -1;                         // tendon
    if(v<(back?0.215:0.245)) return -1;                       // tete
    int best=-1; double bd=1e9;
    foreach(var c in Ref){ double dr=r-c[1],dg=g-c[2],db=b-c[3]; double d=dr*dr+dg*dg+db*db; if(d<bd){bd=d;best=c[0];} }
    if(bd>75*75) return -1;
    if(best==10 && !(back && u>0.62&&u<0.88&&v>0.38&&v<0.53)) return -1;   // marron clair hors lombaires = peau
    if(best==6 || best==11){                                              // turquoise : trapezes en haut, adducteurs en bas
      if(v>0.5) best=11; else if(v<(back?0.45:0.3)) best=6; else return -1; }
    if(best==2 && (back || !(g>r+20 && g>b+12))) best=13;                 // gris (pas vert) = mollets
    if(best==8 && !(back && u>0.62 && u<0.89)) return -1;                 // bordeaux hors cuisses arriere = ombre des poings
    if(best==2 && mx<45) return -1;                                       // trait sombre
    if(best==8 && v<0.55) return -1;                                      // bordeaux au-dessus des cuisses = ombre
    if(v>0.535 && (best==0||best==3||best==4||best==5||best==7)) return -1; // poings
    return best;
  }
  public static string Dir; public static int TintW=0;
  public static void Run(string mapPath,string whitePath,string redPath,string outPath,string zonesPath,int[] level,int cx,int cy,int cw,int ch,int ow,int oh){
    int w,h,w2,h2,w3,h3; var map=Load(mapPath,out w,out h); var wh=Load(whitePath,out w2,out h2); var red=Load(redPath,out w3,out h3); int t1,t2; var cyI=Load(Dir+"/cyan.jpg",out t1,out t2); var ja=Load(Dir+"/jaune.jpg",out t1,out t2); var ro=Load(Dir+"/rose.jpg",out t1,out t2);
    var g0=new int[w*h];
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ int j=y*w+x,i=j*4;
      if(Green(map,i) && Green(wh,i)) { g0[j]=-2; continue; }
      g0[j]=Classify(map,i,(double)x/w,(double)y/h); }
    // Filtre majoritaire rayon 2 pour lisser les bords des zones
    var g1=new int[w*h]; var cnt=new int[14];
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ int j=y*w+x; int c=g0[j];
      if(c<0){ g1[j]=c; continue; }
      Array.Clear(cnt,0,14);
      for(int dy=-3;dy<=3;dy++){ int yy=y+dy; if(yy<0||yy>=h) continue; for(int dx=-3;dx<=3;dx++){ int xx=x+dx; if(xx<0||xx>=w) continue; int n=g0[yy*w+xx]; if(n>=0) cnt[n]++; } }
      int best=c,bc=cnt[c]; for(int k=0;k<14;k++) if(cnt[k]>bc){bc=cnt[k];best=k;} g1[j]=best; }
    // fragments < 1500 px : rattaches au groupe voisin majoritaire
    var lab=new int[w*h]; for(int j=0;j<w*h;j++) lab[j]=-1; var st=new System.Collections.Generic.List<int>(); var comp=new System.Collections.Generic.List<int>();
    for(int j0=0;j0<w*h;j0++){ if(g1[j0]<0||lab[j0]>=0) continue; int c=g1[j0]; st.Clear(); comp.Clear(); st.Add(j0); lab[j0]=j0;
      while(st.Count>0){ int j=st[st.Count-1]; st.RemoveAt(st.Count-1); comp.Add(j); int x=j%w,y=j/w;
        int[] nb={x>0?j-1:-1,x<w-1?j+1:-1,y>0?j-w:-1,y<h-1?j+w:-1}; foreach(int n in nb){ if(n>=0&&lab[n]<0&&g1[n]==c){lab[n]=j0;st.Add(n);} } }
      if(comp.Count<1500){ var cc=new int[14]; foreach(int j in comp){ int x=j%w,y=j/w; for(int k=-4;k<=4;k+=4){ int[] nb={ (x+k>=0&&x+k<w&&y-4>=0)?j-4*w+k:-1, (x+k>=0&&x+k<w&&y+4<h)?j+4*w+k:-1 }; foreach(int n in nb){ if(n>=0&&g1[n]>=0&&g1[n]!=c) cc[g1[n]]++; } } }
        int bb=-1,bv=0; for(int k=0;k<14;k++) if(cc[k]>bv){bv=cc[k];bb=k;} foreach(int j in comp) g1[j]= bb>=0?bb:-1; } }
    var res=new byte[w*h*4]; var zon=new byte[w*h*4];
    for(int j=0;j<w*h;j++){ int i=j*4; int c=g1[j];
      if(c==-2){ continue; }
      if(Green(wh,i)){ continue; }
      res[i+3]=255; zon[i+3]=255;
      if(c==-5){ res[i]=red[i];res[i+1]=red[i+1];res[i+2]=red[i+2]; zon[i+3]=0; continue; }
      if(c==-1){ res[i]=wh[i];res[i+1]=wh[i+1];res[i+2]=wh[i+2]; zon[i+3]=0; continue; }
      int lv=level[c];
      if(lv==0){ if(TintW==1){ res[i]=(byte)(wh[i]*0.95); res[i+1]=(byte)(wh[i+1]*0.84); res[i+2]=(byte)(wh[i+2]*0.82);} else { res[i]=wh[i];res[i+1]=wh[i+1];res[i+2]=wh[i+2]; } }
      else if(lv==1){ res[i]=cyI[i];res[i+1]=cyI[i+1];res[i+2]=cyI[i+2]; }
      else if(lv==3){ res[i]=ro[i];res[i+1]=ro[i+1];res[i+2]=ro[i+2]; }
      else { double f=Math.Min(1.0,ja[i+1]/240.0); double hi=Math.Max(0,(ja[i]-60)/195.0);
        double rr=ja[i+2]/255.0; res[i+2]=(byte)Math.Min(255,255*Math.Min(1.0,rr*1.02)+hi*0); res[i+1]=(byte)Math.Min(255,206*f+hi*49); res[i]=(byte)Math.Min(255,45*f+hi*210); }
      zon[i+2]=(byte)(c*16+8); zon[i+1]=0; zon[i]=0;
    }
    Save(res,w,h,outPath,cx,cy,cw,ch,ow,oh); if(!string.IsNullOrEmpty(zonesPath)) SaveNearest(zon,w,h,zonesPath,cx,cy,cw,ch,ow,oh);
  }
  static void SaveNearest(byte[] buf,int w,int h,string path,int cx,int cy,int cw,int ch,int ow,int oh){
    var o=new byte[ow*oh*4];
    for(int y=0;y<oh;y++) for(int x=0;x<ow;x++){ int sx=cx+(int)((x+0.5)*cw/ow), sy=cy+(int)((y+0.5)*ch/oh); if(sx>=w||sy>=h) continue; int si=(sy*w+sx)*4, di=(y*ow+x)*4; o[di]=buf[si];o[di+1]=buf[si+1];o[di+2]=buf[si+2];o[di+3]=buf[si+3]; }
    using(var bm=new Bitmap(ow,oh,PixelFormat.Format32bppArgb)){ var d=bm.LockBits(new Rectangle(0,0,ow,oh),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb); Marshal.Copy(o,0,d.Scan0,o.Length); bm.UnlockBits(d); bm.Save(path,ImageFormat.Png);} }
  static void Save(byte[] buf,int w,int h,string path,int cx,int cy,int cw,int ch,int ow,int oh){
    using(var bm=new Bitmap(w,h,PixelFormat.Format32bppArgb)){ var d=bm.LockBits(new Rectangle(0,0,w,h),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb); Marshal.Copy(buf,0,d.Scan0,buf.Length); bm.UnlockBits(d);
      using(var o=new Bitmap(ow,oh,PixelFormat.Format32bppArgb)) using(var g=Graphics.FromImage(o)){ g.Clear(Color.Transparent); g.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic; g.PixelOffsetMode=System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
        g.DrawImage(bm,new Rectangle(0,0,ow,oh),new Rectangle(cx,cy,cw,ch),GraphicsUnit.Pixel); o.Save(path,ImageFormat.Png);} } }
}
"@
Add-Type -TypeDefinition $src -ReferencedAssemblies System.Drawing
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
[MuscleMapPrep]::Dir=$Dir
foreach($lvl in 0..3){
  $lv=[int[]](@($lvl)*14)
  $z = $null; if($lvl -eq 0){ $z = Join-Path $OutDir 'zones.png' }
  [MuscleMapPrep]::Run((Join-Path $Dir 'c2.jpg'), (Join-Path $Dir 'blanc.jpg'), (Join-Path $Dir 'rouge.jpg'), (Join-Path $OutDir "rendu-$lvl.png"), $z, $lv, 64, 32, 1940, 1988, 640, 656)
}
Get-ChildItem $OutDir | Select-Object Name, Length
