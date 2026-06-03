type PathData = { d: string; color: string; width: number };
type PendingAnnotation = { photoId: string; paths: PathData[] };

// Module-level store: draw-photo writes here, new-entry consumes on focus
let _pending: PendingAnnotation | null = null;

export function setPendingAnnotation(photoId: string, paths: PathData[]) {
  _pending = { photoId, paths };
}

export function consumePendingAnnotation(): PendingAnnotation | null {
  const result = _pending;
  _pending = null;
  return result;
}
