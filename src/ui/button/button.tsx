import { type JSX, Show, splitProps } from 'solid-js'
import { Icon } from '../icon/icon'
import type { IconName } from '../icon/icons'
import styles from './button.module.css'

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ghost has no fill until hovered, for actions that shouldn't draw the eye. */
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Removes or resets something; drawn in the danger color. */
  danger?: boolean
  /** Drawn before the label. Page-only icons need page-icons.ts loaded. */
  icon?: IconName
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, [
    'variant',
    'danger',
    'class',
    'type',
    'icon',
    'children',
  ])
  return (
    <button
      type={local.type ?? 'button'}
      class={`${styles.button} ${styles[local.variant ?? 'secondary']} ${local.danger ? styles.danger : ''} ${local.class ?? ''}`}
      {...rest}
    >
      <Show when={local.icon}>{(name) => <Icon name={name()} />}</Show>
      {local.children}
    </button>
  )
}
