import { type JSX, Show, splitProps } from 'solid-js'
import { Icon } from '../icon/icon'
import type { IconName } from '../icon/icons'
import styles from './button.module.css'

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  /** Drawn before the label. Page-only icons need page-icons.ts loaded. */
  icon?: IconName
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ['variant', 'class', 'type', 'icon', 'children'])
  return (
    <button
      type={local.type ?? 'button'}
      class={`${styles.button} ${styles[local.variant ?? 'secondary']} ${local.class ?? ''}`}
      {...rest}
    >
      <Show when={local.icon}>{(name) => <Icon name={name()} />}</Show>
      {local.children}
    </button>
  )
}
