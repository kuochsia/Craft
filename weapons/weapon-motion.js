(function (global) {
  const durations = {
    arc: 0.12,
    recoil: 0.12
  };

  function getPose(motion, progress) {
    const t = Math.max(0, Math.min(1, progress));
    const pulse = Math.sin(Math.PI * t);

    if (motion === 'recoil') {
      return {
        x: 0.2 * pulse,
        y: 0,
        z: 0.06 * pulse
      };
    }

    const strike = t < 0.22
      ? 0.18 * t / 0.22
      : t < 0.62
        ? 0.18 + 0.95 * ((t - 0.22) / 0.4)
        : 1.13 * (1 - (t - 0.62) / 0.38);
    return {
      x: strike,
      y: 0.12 * pulse,
      z: 0.1 * pulse
    };
  }

  global.MinecraftWeaponMotion = {
    durations,
    getPose
  };
})(window);
