import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [NgIf],
  templateUrl: './checkbox.html',
  styleUrls: ['./checkbox.css'],
})
export class Checkbox {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() label?: string;
  @Output() checkedChange = new EventEmitter<boolean>();

  toggle() {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.checkedChange.emit(this.checked);
  }

  onKeydown(event: KeyboardEvent) {
    if (this.disabled) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.toggle();
    }
  }
}
