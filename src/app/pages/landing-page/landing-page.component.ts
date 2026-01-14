import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  QueryList,
  ViewChildren
} from '@angular/core';
import { RouterModule } from '@angular/router';

import { BenefitsComponent } from '../../components/benefits/benefits.component';
import { FaqComponent } from '../../components/faq/faq.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { HeroSectionComponent } from '../../components/hero-section/hero-section.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { PricingComponent } from '../../components/pricing/pricing.component';
import { ContactFormComponent } from '../../components/contact-form/contact-form.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    BenefitsComponent,
    ContactFormComponent,
    FaqComponent,
    FooterComponent,
    HeroSectionComponent,
    HowItWorksComponent,
    PricingComponent,
    RouterModule
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent {
  isNavOpen = false;
  activeSectionIndex = 0;
  private sectionObserver?: IntersectionObserver;
  private rafId?: number;
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private orbActive = false;
  private bgOrbs: Array<{ el: HTMLElement; baseX: number; baseY: number }> = [];
  private orbCanvas?: HTMLCanvasElement;
  private orbCtx?: CanvasRenderingContext2D | null;
  private orbRect?: DOMRect;
  private lastFrameTime?: number;
  private readonly targetRows = 6;
  private readonly ballRadius = 4.2;
  private particles: Array<{ x: number; y: number; vx: number; vy: number; bx: number; by: number }> = [];

  @ViewChildren('scrollSection') sections?: QueryList<ElementRef<HTMLElement>>;

  toggleNav(): void {
    this.isNavOpen = !this.isNavOpen;
  }

  closeNav(): void {
    this.isNavOpen = false;
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.targetX = event.clientX;
    this.targetY = event.clientY;
    this.orbActive = true;
    this.startOrbAnimation();
  }

  ngAfterViewInit(): void {
    const nodes = this.sections?.toArray() ?? [];
    if (!nodes.length) {
      return;
    }

    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index') ?? 0);
            this.activeSectionIndex = index;
          }
        });
      },
      { threshold: 0.35 }
    );

    nodes.forEach((node) => this.sectionObserver?.observe(node.nativeElement));

    this.bgOrbs = Array.from(document.querySelectorAll<HTMLElement>('.bg-orb')).map((el) => {
      const baseX = Number(el.style.getPropertyValue('--base-x')) || 50;
      const baseY = Number(el.style.getPropertyValue('--base-y')) || 50;
      return { el, baseX, baseY };
    });

    this.orbCanvas = document.querySelector<HTMLCanvasElement>('.orb-canvas') ?? undefined;
    this.orbCtx = this.orbCanvas?.getContext('2d');
    this.resizeOrbCanvas();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.orbActive) {
      this.orbRect = this.orbCanvas?.getBoundingClientRect();
      this.startOrbAnimation();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeOrbCanvas();
  }

  ngOnDestroy(): void {
    this.sectionObserver?.disconnect();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }

  private startOrbAnimation(): void {
    if (this.rafId) {
      return;
    }

    const animate = () => {
      const dx = this.targetX - this.currentX;
      const dy = this.targetY - this.currentY;
      this.currentX += dx * 0.3;
      this.currentY += dy * 0.3;

      document.documentElement.style.setProperty('--orb-x', `${this.currentX}px`);
      document.documentElement.style.setProperty('--orb-y', `${this.currentY}px`);

      this.bgOrbs.forEach((orb) => {
        const baseX = (orb.baseX / 100) * window.innerWidth;
        const baseY = (orb.baseY / 100) * window.innerHeight;
        const vx = baseX - this.currentX;
        const vy = baseY - this.currentY;
        const dist = Math.hypot(vx, vy) || 1;
        const influence = 360;
        const force = Math.max(influence - dist, 0) / influence;
        const offsetX = (vx / dist) * force * 90;
        const offsetY = (vy / dist) * force * 90;
        orb.el.style.setProperty('--offset-x', `${offsetX}px`);
        orb.el.style.setProperty('--offset-y', `${offsetY}px`);
      });

      this.updateParticles();

      if (!this.orbActive || (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2)) {
        this.rafId = undefined;
        return;
      }

      this.rafId = requestAnimationFrame(animate);
    };

    this.rafId = requestAnimationFrame(animate);
  }

  private resizeOrbCanvas(): void {
    if (!this.orbCanvas || !this.orbCtx) {
      return;
    }

    const rect = this.orbCanvas.getBoundingClientRect();
    this.orbRect = rect;
    this.orbCanvas.width = rect.width * window.devicePixelRatio;
    this.orbCanvas.height = rect.height * window.devicePixelRatio;
    this.orbCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    this.createParticles(rect.width, rect.height);
    this.updateParticles();
  }

  private createParticles(width: number, height: number): void {
    const targetRows = Math.max(this.targetRows, 1);
    const spacing = Math.max(this.ballRadius * 2, 1);
    const cols = Math.floor(width / spacing);
    const rows = targetRows;
    const startX = spacing * 0.5;
    const startY = height - rows * spacing + spacing * 0.5;
    this.particles = [];

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const px = startX + x * spacing;
        const py = startY + y * spacing;
        this.particles.push({ x: px, y: py, vx: 0, vy: 0, bx: px, by: py });
      }
    }
  }

  private updateParticles(): void {
    if (!this.orbCtx || !this.orbRect) {
      return;
    }

    const ctx = this.orbCtx;
    const width = this.orbRect.width;
    const height = this.orbRect.height;
    const cx = this.currentX - this.orbRect.left;
    const cy = this.currentY - this.orbRect.top;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(185, 230, 255, 1)';
    ctx.shadowColor = 'rgba(45, 156, 255, 0.85)';
    ctx.shadowBlur = 14;

    const influence = 140;
    const repel = 2.2;
    const spring = 0.08;
    const damping = 0.82;

    const now = performance.now();
    const delta = this.lastFrameTime ? Math.min((now - this.lastFrameTime) / 16.67, 2) : 1;
    this.lastFrameTime = now;

    for (const p of this.particles) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist < influence) {
        const force = (influence - dist) / influence;
        p.vx += (dx / dist) * force * repel * delta;
        p.vy += (dy / dist) * force * repel * delta;
      }

      p.vx += (p.bx - p.x) * spring * delta;
      p.vy += (p.by - p.y) * spring * delta;
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx * delta;
      p.y += p.vy * delta;

      ctx.beginPath();
      ctx.arc(p.x, p.y, this.ballRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
