import * as RE from 'rogue-engine';
import { DOM } from '../DOM';

export class Transition {
  static fadeOut(duration: number = 500, color: string = "black") {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = color;
    overlay.style.opacity = '0';
    overlay.style.transition = `opacity ${duration}ms ease-in-out`;
    overlay.style.zIndex = '10000';

    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.opacity = '1';
    }, 10);

    return new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }

  static fadeIn(duration: number = 500, color: string = "black") {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = color;
    overlay.style.opacity = '1';
    overlay.style.transition = `opacity ${duration}ms ease-in-out`;
    overlay.style.zIndex = '10000';

    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.opacity = '0';
    }, 10);

    setTimeout(() => {
      overlay.parentElement?.removeChild(overlay);
    }, duration);
  }

  static circleWipeOut(duration: number = 800, color: string = "black") {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.width = '0';
    overlay.style.height = '0';
    overlay.style.backgroundColor = color;
    overlay.style.borderRadius = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.transition = `width ${duration}ms ease-in-out, height ${duration}ms ease-in-out`;
    overlay.style.zIndex = '10000';

    document.body.appendChild(overlay);

    setTimeout(() => {
      const size = Math.max(window.innerWidth, window.innerHeight) * 2;
      overlay.style.width = `${size}px`;
      overlay.style.height = `${size}px`;
    }, 10);

    return new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }

  static circleWipeIn(duration: number = 800, color: string = "black") {
    const size = Math.max(window.innerWidth, window.innerHeight) * 2;
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.width = `${size}px`;
    overlay.style.height = `${size}px`;
    overlay.style.backgroundColor = color;
    overlay.style.borderRadius = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.transition = `width ${duration}ms ease-in-out, height ${duration}ms ease-in-out`;
    overlay.style.zIndex = '10000';

    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.width = '0px';
      overlay.style.height = '0px';
    }, 10);

    setTimeout(() => {
      overlay.parentElement?.removeChild(overlay);
    }, duration);
  }

  static slideOut(duration: number = 600, color: string = "#222") {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '-100%';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = color;
    overlay.style.transition = `left ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    overlay.style.zIndex = '10000';

    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.left = '0';
    }, 10);

    return new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }

  static slideIn(duration: number = 600, color: string = "#222") {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = color;
    overlay.style.transition = `left ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    overlay.style.zIndex = '10000';

    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.left = '100%';
    }, 10);

    setTimeout(() => {
      overlay.parentElement?.removeChild(overlay);
    }, duration);
  }

  static irisOut(duration: number = 700) {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'black';
    overlay.style.clipPath = 'circle(0% at 50% 50%)';
    overlay.style.transition = `clip-path ${duration}ms ease-in-out`;
    overlay.style.zIndex = '10000';

    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.clipPath = 'circle(75% at 50% 50%)';
    }, 10);

    return new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }

  static irisIn(duration: number = 700) {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'black';
    overlay.style.clipPath = 'circle(75% at 50% 50%)';
    overlay.style.transition = `clip-path ${duration}ms ease-in-out`;
    overlay.style.zIndex = '10000';

    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.clipPath = 'circle(0% at 50% 50%)';
    }, 10);

    setTimeout(() => {
      overlay.parentElement?.removeChild(overlay);
    }, duration);
  }

  static matrix(duration: number = 2000, color: string = "#0F0") {
    const canvas = DOM.create('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '10000';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    document.body.appendChild(canvas);

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops: number[] = [];

    for (let x = 0; x < columns; x++) {
      drops[x] = 1;
    }

    let startTime = Date.now();

    function draw() {
      if (Date.now() - startTime > duration) {
        canvas.parentElement?.removeChild(canvas);
        return;
      }

      ctx!.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
      ctx!.fillStyle = color;
      ctx!.font = `${fontSize}px arial`;

      for (let i = 0; i < drops.length; i++) {
        const text = letters[Math.floor(Math.random() * letters.length)];
        ctx!.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      requestAnimationFrame(draw);
    }

    draw();
  }

  static dissolve(duration: number = 1000, color: string = "black") {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = color;
    overlay.style.zIndex = '10000';
    document.body.appendChild(overlay);

    const pixelCount = 2000;
    const pixels: HTMLDivElement[] = [];

    for (let i = 0; i < pixelCount; i++) {
      const pixel = DOM.create('div');
      pixel.style.position = 'absolute';
      pixel.style.width = '5%';
      pixel.style.height = '5%';
      pixel.style.backgroundColor = 'white';
      pixel.style.left = `${Math.random() * 100}%`;
      pixel.style.top = `${Math.random() * 100}%`;
      pixel.style.transition = `opacity ${Math.random() * duration}ms ease-in-out`;
      pixel.style.opacity = '1';
      overlay.appendChild(pixel);
      pixels.push(pixel);
    }

    setTimeout(() => {
      pixels.forEach(pixel => {
        pixel.style.opacity = '0';
      });
    }, 10);

    setTimeout(() => {
      overlay.parentElement?.removeChild(overlay);
    }, duration);
  }

  static wipe(duration: number = 800, direction: 'left' | 'right' | 'up' | 'down' = 'right', color: string = "black") {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = color;
    overlay.style.zIndex = '10000';

    let initialClipPath, finalClipPath;

    switch (direction) {
      case 'left':
        initialClipPath = 'inset(0 100% 0 0)';
        finalClipPath = 'inset(0 0 0 0)';
        break;
      case 'right':
        initialClipPath = 'inset(0 0 0 100%)';
        finalClipPath = 'inset(0 0 0 0)';
        break;
      case 'up':
        initialClipPath = 'inset(100% 0 0 0)';
        finalClipPath = 'inset(0 0 0 0)';
        break;
      case 'down':
        initialClipPath = 'inset(0 0 100% 0)';
        finalClipPath = 'inset(0 0 0 0)';
        break;
    }

    overlay.style.clipPath = initialClipPath;
    overlay.style.transition = `clip-path ${duration}ms ease-in-out`;

    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.clipPath = finalClipPath;
    }, 10);

    setTimeout(() => {
      overlay.parentElement?.removeChild(overlay);
    }, duration);
  }

  static blinds(duration: number = 1000, color: string = "black", stripes: number = 8) {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';

    document.body.appendChild(overlay);

    for (let i = 0; i < stripes; i++) {
      const stripe = DOM.create('div');
      stripe.style.flex = '1';
      stripe.style.backgroundColor = color;
      stripe.style.transform = 'scaleX(0)';
      stripe.style.transition = `transform ${duration}ms ease-in-out`;
      stripe.style.transitionDelay = `${(i / stripes) * (duration / 2)}ms`;
      overlay.appendChild(stripe);
    }

    setTimeout(() => {
      overlay.querySelectorAll('div').forEach(stripe => {
        (stripe as HTMLElement).style.transform = 'scaleX(1)';
      });
    }, 10);

    setTimeout(() => {
      overlay.parentElement?.removeChild(overlay);
    }, duration);
  }

  static clock(duration: number = 1000, color: string = "black") {
    const overlay = DOM.create('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = color;
    overlay.style.zIndex = '10000';
    overlay.style.clipPath = 'circle(0% at 50% 50%)';
    overlay.style.transition = `clip-path ${duration}ms linear`;

    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.clipPath = 'circle(150% at 50% 50%)';
    }, 10);

    setTimeout(() => {
      overlay.parentElement?.removeChild(overlay);
    }, duration);
  }
}
