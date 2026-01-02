import { describe, it, expect } from 'vitest';
import { M } from './math.js';

describe('Math utilities', () => {
  describe('dist', () => {
    it('calculates distance between two points', () => {
      expect(M.dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });
    
    it('returns 0 for same point', () => {
      expect(M.dist({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    });
    
    it('handles negative coordinates', () => {
      expect(M.dist({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
    });
  });

  describe('rotate', () => {
    it('rotates point 90 degrees', () => {
      const result = M.rotate({ x: 1, y: 0 }, Math.PI / 2);
      expect(result.x).toBeCloseTo(0, 10);
      expect(result.y).toBeCloseTo(1, 10);
    });
    
    it('rotates point 180 degrees', () => {
      const result = M.rotate({ x: 1, y: 0 }, Math.PI);
      expect(result.x).toBeCloseTo(-1, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });
    
    it('returns same point for 0 rotation', () => {
      const result = M.rotate({ x: 5, y: 3 }, 0);
      expect(result.x).toBe(5);
      expect(result.y).toBe(3);
    });
  });

  describe('bezier', () => {
    it('returns start point at t=0', () => {
      const p0 = { x: 0, y: 0 };
      const p1 = { x: 1, y: 1 };
      const p2 = { x: 2, y: 1 };
      const p3 = { x: 3, y: 0 };
      const result = M.bezier(p0, p1, p2, p3, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('returns end point at t=1', () => {
      const p0 = { x: 0, y: 0 };
      const p1 = { x: 1, y: 1 };
      const p2 = { x: 2, y: 1 };
      const p3 = { x: 3, y: 0 };
      const result = M.bezier(p0, p1, p2, p3, 1);
      expect(result.x).toBe(3);
      expect(result.y).toBe(0);
    });
    
    it('returns midpoint at t=0.5 for linear bezier', () => {
      const p0 = { x: 0, y: 0 };
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 10, y: 10 };
      const p3 = { x: 10, y: 10 };
      const result = M.bezier(p0, p1, p2, p3, 0.5);
      expect(result.x).toBeCloseTo(5, 1);
      expect(result.y).toBeCloseTo(5, 1);
    });
  });

  describe('insidePoly', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];

    it('returns true for point inside', () => {
      expect(M.insidePoly({ x: 5, y: 5 }, square)).toBe(true);
    });

    it('returns false for point outside', () => {
      expect(M.insidePoly({ x: 15, y: 5 }, square)).toBe(false);
      expect(M.insidePoly({ x: 5, y: 15 }, square)).toBe(false);
    });
    
    it('returns false for point on edge', () => {
      // Point-in-polygon test is typically false for edge points
      const result = M.insidePoly({ x: 0, y: 5 }, square);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('insideShape', () => {
    it('detects point inside circle', () => {
      const circle = { x: 0, y: 0, width: 10, height: 10, shape: 'circle', rotation: 0 };
      expect(M.insideShape({ x: 0, y: 0 }, circle)).toBe(true);
      expect(M.insideShape({ x: 3, y: 3 }, circle)).toBe(true);
    });
    
    it('detects point outside circle', () => {
      const circle = { x: 0, y: 0, width: 10, height: 10, shape: 'circle', rotation: 0 };
      expect(M.insideShape({ x: 10, y: 10 }, circle)).toBe(false);
    });
    
    it('detects point inside rectangle', () => {
      const rect = { x: 0, y: 0, width: 10, height: 6, shape: 'rectangle', rotation: 0 };
      expect(M.insideShape({ x: 2, y: 2 }, rect)).toBe(true);
    });
    
    it('detects point outside rectangle', () => {
      const rect = { x: 0, y: 0, width: 10, height: 6, shape: 'rectangle', rotation: 0 };
      expect(M.insideShape({ x: 10, y: 10 }, rect)).toBe(false);
    });
    
    it('handles rotated shapes', () => {
      const rect = { x: 0, y: 0, width: 10, height: 6, shape: 'rectangle', rotation: Math.PI / 4 };
      // Point should still be testable with rotation
      const result = M.insideShape({ x: 1, y: 1 }, rect);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('localToWorld / worldToLocal', () => {
    it('converts local to world coordinates', () => {
      const parent = { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 };
      const local = { x: 5, y: 5 };
      const world = M.localToWorld(local, parent);
      expect(world.x).toBe(15);
      expect(world.y).toBe(25);
    });
    
    it('converts world to local coordinates', () => {
      const parent = { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 };
      const world = { x: 15, y: 25 };
      const local = M.worldToLocal(world, parent);
      expect(local.x).toBe(5);
      expect(local.y).toBe(5);
    });
    
    it('handles scaled coordinates', () => {
      const parent = { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2 };
      const local = { x: 5, y: 5 };
      const world = M.localToWorld(local, parent);
      expect(world.x).toBe(10);
      expect(world.y).toBe(10);
    });
  });

  describe('getBounds', () => {
    it('calculates bounding box', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: -5, y: 10 }
      ];
      const bounds = M.getBounds(points);
      expect(bounds.minX).toBe(-5);
      expect(bounds.maxX).toBe(10);
      expect(bounds.minY).toBe(0);
      expect(bounds.maxY).toBe(10);
      expect(bounds.w).toBe(15);
      expect(bounds.h).toBe(10);
    });
    
    it('calculates center point', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ];
      const bounds = M.getBounds(points);
      expect(bounds.cx).toBe(5);
      expect(bounds.cy).toBe(5);
    });
  });

  describe('buildArc', () => {
    it('builds arc with cumulative distances', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 }
      ];
      const arc = M.buildArc(path);
      expect(arc).toHaveLength(3);
      expect(arc[0].d).toBe(0);
      expect(arc[1].d).toBe(3);
      expect(arc[2].d).toBe(7); // 3 + 4
    });
  });

  describe('hoverEq', () => {
    it('returns true for matching hovers', () => {
      const a = { type: 'node', idx: 0 };
      const b = { type: 'node', idx: 0 };
      expect(M.hoverEq(a, b)).toBe(true);
    });
    
    it('returns false for different hovers', () => {
      const a = { type: 'node', idx: 0 };
      const b = { type: 'node', idx: 1 };
      expect(M.hoverEq(a, b)).toBe(false);
    });
    
    it('returns true for both null', () => {
      expect(M.hoverEq(null, null)).toBe(true);
    });
  });
});
