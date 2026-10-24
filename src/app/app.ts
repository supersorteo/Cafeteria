import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme.service';
import { NoticeBanner } from './shared/notice-banner';

@Component({
  imports: [RouterOutlet, NoticeBanner],
  selector: 'app-root',
  template: '<app-notice-banner /><router-outlet />',
})
export class App {
  constructor() {
    inject(ThemeService);
  }
}
