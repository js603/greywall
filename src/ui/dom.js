const qs = (e, t = document) => {
  return t.querySelector(e);
};
const escapeHtml = (e) => {
  return e.replace(/[&<>"]/g, (e) => {
    return {
      "&": `&amp;`,
      "<": `&lt;`,
      ">": `&gt;`,
      '"': `&quot;`,
    }[e];
  });
};

export { qs, escapeHtml };
