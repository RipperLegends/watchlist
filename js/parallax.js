(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const targets = [
    ...document.querySelectorAll('.hero-card, .hero-preview, .page-lead, .profile-identity-card, .profile-workspace-card')
  ];

  if (!targets.length) return;

  targets.forEach((node, index) => {
    if (!node.hasAttribute('data-parallax')) {
      node.setAttribute('data-parallax', '');
    }
    node.dataset.parallaxDepth = String(((index % 3) + 1) * 6);
  });

  let mouseX = 0;
  let mouseY = 0;
  let currentX = 0;
  let currentY = 0;

  const animate = () => {
    currentX += (mouseX - currentX) * 0.08;
    currentY += (mouseY - currentY) * 0.08;

    targets.forEach((node) => {
      const depth = Number(node.dataset.parallaxDepth || 6);
      const offsetX = currentX / depth;
      const offsetY = currentY / depth;
      node.style.setProperty('--parallax-x', `${offsetX}px`);
      node.style.setProperty('--parallax-y', `${offsetY}px`);
    });

    requestAnimationFrame(animate);
  };

  window.addEventListener('mousemove', (event) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    mouseX = (event.clientX - centerX) / 22;
    mouseY = (event.clientY - centerY) / 22;
  });

  window.addEventListener('mouseleave', () => {
    mouseX = 0;
    mouseY = 0;
  });

  window.addEventListener('scroll', () => {
    const scrollShift = window.scrollY * -0.02;
    targets.forEach((node) => {
      node.style.setProperty('--scroll-shift', `${scrollShift}px`);
    });
  }, { passive: true });

  requestAnimationFrame(animate);
})();
