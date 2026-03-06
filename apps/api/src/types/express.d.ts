declare namespace Express {
  interface Request {
    user?: {
      id: bigint;
      uid: Uint8Array<ArrayBuffer>;
      name: string;
    };
  }
}
