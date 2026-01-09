import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.css'
})
export class HeroSectionComponent implements AfterViewInit, OnDestroy {
  isFooterVisible = false;
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    const footer = document.querySelector('footer');
    if (!footer) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        this.isFooterVisible = entries.some((entry) => entry.isIntersecting);
      },
      { root: null, threshold: 0 }
    );

    this.observer.observe(footer);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
