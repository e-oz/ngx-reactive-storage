import { Component } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatSliderModule } from "@angular/material/slider";
import { RxStorage } from "@oz/reactive-storage";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    MatSlideToggleModule,
    MatSliderModule,
    FormsModule,
    MatExpansionModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  protected readonly storage = new RxStorage('example', 'ngx-reactive-storage');
  protected readonly $toggle = this.storage.getWritableSignal<boolean>('toggle', { initialValue: true });
  protected readonly $slider = this.storage.getWritableSignal<number>('slider', { initialValue: 50 });
  protected readonly $expanded = this.storage.getWritableSignal<boolean>('expanded');
}
