import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgIf, NgClass } from '@angular/common';

@Component({
  selector: 'app-nav-item',
  standalone: true,
  imports: [RouterLink, FontAwesomeModule, NgIf, NgClass],
  templateUrl: './nav-item.html',
  styleUrls: ['./nav-item.css'],
})
export class NavItem {
  @Input() link?: string;
  @Input() icon?: any;
  // wrapper classes for the container (icon+text)
  @Input() classes?: string;
  // icon-specific classes
  @Input() iconClasses?: string;

  // defaults to keep templates DRY
  protected readonly defaultWrapper =
    'group flex items-center gap-2 text-sm text-slate-600 hover:text-[#58a9ff] focus:outline-none focus:ring-2 focus:ring-[#58a9ff] rounded-md px-2 py-1';
  protected readonly defaultIcon =
    'w-4 h-4 inline-block align-middle flex-shrink-0 group-hover:text-[#58a9ff] transition-colors duration-150';

  @Output() activated = new EventEmitter<void>();

  emitActivate() {
    this.activated.emit();
  }
}
