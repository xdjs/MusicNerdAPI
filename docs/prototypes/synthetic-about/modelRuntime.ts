import { currentScope, type Adapter } from "./context";
export const adapter = {
  synthesizeArtistDoc: (...args: Parameters<Adapter["synthesizeArtistDoc"]>) =>
    currentScope().adapter.synthesizeArtistDoc(...args),
  generateAboutFromDoc: (...args: Parameters<Adapter["generateAboutFromDoc"]>) =>
    currentScope().adapter.generateAboutFromDoc(...args),
  generateLoreSummary: (...args: Parameters<Adapter["generateLoreSummary"]>) =>
    currentScope().adapter.generateLoreSummary(...args),
};
