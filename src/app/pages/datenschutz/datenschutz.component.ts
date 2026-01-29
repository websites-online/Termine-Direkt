import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-datenschutz',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './datenschutz.component.html',
  styleUrl: './datenschutz.component.css'
})
export class DatenschutzComponent {}
