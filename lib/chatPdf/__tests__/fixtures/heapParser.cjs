module.exports = () => {
  const retained = [];
  for (;;) retained.push(new Array(100000).fill(Math.random()));
};
