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
      this.currentX += dx * 0.12;
      this.currentY += dy * 0.12;

      document.documentElement.style.setProperty('--orb-x', `${this.currentX}px`);
      document.documentElement.style.setProperty('--orb-y', `${this.currentY}px`);

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        this.rafId = undefined;
        return;
      }

      this.rafId = requestAnimationFrame(animate);
    };

    this.rafId = requestAnimationFrame(animate);
  }
}
