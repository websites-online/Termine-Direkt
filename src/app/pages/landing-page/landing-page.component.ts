import { AfterViewInit, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { BenefitsComponent } from '../../components/benefits/benefits.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { PricingComponent } from '../../components/pricing/pricing.component';
import { FaqComponent } from '../../components/faq/faq.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { ContactFormComponent } from '../../components/contact-form/contact-form.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BenefitsComponent,
    HowItWorksComponent,
    PricingComponent,
    FaqComponent,
    FooterComponent,
    ContactFormComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent implements OnInit, AfterViewInit {
  private readonly soroScriptId = 'soro-blog-embed-script';
  private readonly soroScriptSrc = 'https://app.trysoro.com/api/embed/f8a7eab0-b7c4-4561-9e23-8347ca2a2c3e';
  isNavOpen = false;
  isNavCompact = false;
  isSoroBlogFallbackVisible = true;
  scrollProgress = 0;
  pointerTiltX = 0;
  pointerTiltY = 0;
  private viewportFrame = 0;
  private pointerFrame = 0;
  private lastPointerEvent: MouseEvent | null = null;

  ngOnInit(): void {
    this.updateViewportEffects();
  }

  ngAfterViewInit(): void {
    this.loadSoroBlog();
  }

  toggleNav(): void {
    this.isNavOpen = !this.isNavOpen;
  }

  closeNav(): void {
    this.isNavOpen = false;
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  updateViewportEffects(): void {
    if (this.viewportFrame) {
      return;
    }

    this.viewportFrame = window.requestAnimationFrame(() => {
      this.viewportFrame = 0;
      this.applyViewportEffects();
    });
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (window.innerWidth < 900) {
      return;
    }

    this.lastPointerEvent = event;

    if (this.pointerFrame) {
      return;
    }

    this.pointerFrame = window.requestAnimationFrame(() => {
      this.pointerFrame = 0;
      this.applyPointerTilt();
    });
  }

  private applyViewportEffects(): void {
    const scrollRange = Math.max(window.innerHeight * 1.8, 1200);
    const normalized = Math.min(window.scrollY / scrollRange, 1);
    this.scrollProgress = Number(normalized.toFixed(4));
    this.isNavCompact = window.scrollY > 24;

    if (window.innerWidth < 900) {
      this.pointerTiltX = Number((Math.sin(normalized * Math.PI * 2) * 0.22).toFixed(4));
      this.pointerTiltY = Number(((normalized - 0.5) * 0.5).toFixed(4));
    }
  }

  private applyPointerTilt(): void {
    if (!this.lastPointerEvent) {
      return;
    }

    const x = this.lastPointerEvent.clientX / window.innerWidth;
    const y = this.lastPointerEvent.clientY / window.innerHeight;
    this.pointerTiltX = Number(((x - 0.5) * 2).toFixed(4));
    this.pointerTiltY = Number(((y - 0.5) * 2).toFixed(4));
  }

  private loadSoroBlog(): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.getElementById(this.soroScriptId)?.remove();

    const script = document.createElement('script');
    script.id = this.soroScriptId;
    script.src = this.soroScriptSrc;
    script.defer = true;
    script.onload = () => {
      window.setTimeout(() => {
        const blogRoot = document.getElementById('soro-blog');
        this.isSoroBlogFallbackVisible = !blogRoot?.childElementCount;
      }, 800);
    };
    document.body.appendChild(script);
  }
}
