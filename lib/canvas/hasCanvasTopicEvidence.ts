/** An equipment question needs explicit equipment language; term presence still requires reading negation and attribution. */
export function hasCanvasTopicEvidence(query: string, text: string): boolean {
  const equipment =
    /\b(?:gear|equipment|synth(?:esizer|esiser|s)?|modular synthesizer|drum machine|microphone|audio interface|DAW|sampler|synthesis|hardware setup)\b/i;
  const namedTools =
    /\b(?:Moog|Oberheim|Digitakt|Elektron|Ableton|FL Studio|Logic Pro|SP-404|MPC)\b/i;
  return !equipment.test(query) || equipment.test(text) || namedTools.test(text);
}
