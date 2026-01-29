import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-impressum',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './impressum.component.html',
  styleUrl: './impressum.component.css'
})
export class ImpressumComponent {}
