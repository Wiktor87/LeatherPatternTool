// Minimal ClipperLib stub for testing
window.ClipperLib = {
  Clipper: function() {
    this.AddPath = function() {};
    this.Execute = function() { return true; };
  },
  PolyType: { ptSubject: 0, ptClip: 1 },
  ClipType: { ctUnion: 0 },
  PolyFillType: { pftNonZero: 0 }
};
ClipperLib.Clipper.Area = function() { return 1000; };
console.log("ClipperLib stub loaded");
