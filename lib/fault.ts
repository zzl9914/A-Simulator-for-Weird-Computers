export class MachineFault extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MachineFault";
  }
}
