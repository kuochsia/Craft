(function (global) {
  function create(pixels) {
    if (!Array.isArray(pixels) || pixels.length !== 16 || pixels.some((row) => !Array.isArray(row) || row.length !== 16)) {
      throw new Error('Un aperçu d’arme nécessite une grille de 16 × 16 pixels.');
    }

    const pathsByColor = new Map();
    pixels.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color < 0) return;
        const hex = `#${color.toString(16).padStart(6, '0')}`;
        pathsByColor.set(hex, `${pathsByColor.get(hex) || ''}M${x} ${y}h1v1h-1z`);
      });
    });

    const paths = [...pathsByColor]
      .map(([color, path]) => `<path fill="${color}" d="${path}"/>`)
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${paths}</svg>`;
  }

  global.MinecraftWeaponPreview = { create };
})(window);
