import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  showHome = false;

  constructor(private readonly router: Router) {
    this.showHome = this.shouldShowHome(this.router.url);
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const current = (event as NavigationEnd).urlAfterRedirects;
      this.showHome = this.shouldShowHome(current);
    });
  }

  private shouldShowHome(url: string): boolean {
    return url.startsWith('/impressum') || url.startsWith('/datenschutz') || url.startsWith('/demo-unternehmen');
  }
}
