export class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  async *stream(prompt) {
    throw new Error(`${this.name}: stream() not implemented`);
  }
}
