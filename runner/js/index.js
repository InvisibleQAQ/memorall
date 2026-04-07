document.documentElement.classList.add("js");

const initLandingPage = () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const progressBar = document.querySelector(".scroll-progress");
  const hero = document.querySelector(".hero");
  const revealTargets = document.querySelectorAll(".reveal:not(.is-visible)");

  if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );

    revealTargets.forEach((element, index) => {
      element.style.setProperty("--reveal-delay", `${Math.min(index * 45, 220)}ms`);
      observer.observe(element);
    });
  } else {
    revealTargets.forEach((element) => element.classList.add("is-visible"));
  }

  const updateScrollProgress = () => {
    if (!progressBar) {
      return;
    }

    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    progressBar.style.setProperty("--scroll-scale", ratio.toFixed(3));
  };

  updateScrollProgress();
  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  window.addEventListener("resize", updateScrollProgress);

  if (!reduceMotion && hero) {
    const resetPointer = () => {
      document.documentElement.style.setProperty("--pointer-x", "0");
      document.documentElement.style.setProperty("--pointer-y", "0");
    };

    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

      document.documentElement.style.setProperty("--pointer-x", x.toFixed(3));
      document.documentElement.style.setProperty("--pointer-y", y.toFixed(3));
    });

    hero.addEventListener("pointerleave", resetPointer);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLandingPage, { once: true });
} else {
  initLandingPage();
}
