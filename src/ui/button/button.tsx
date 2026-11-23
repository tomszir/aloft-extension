import { type JSX, splitProps } from 'solid-js'
import styles from './button.module.css'

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ['variant', 'class', 'type'])
  return (
    <button
      type={local.type ?? 'button'}
      class={`${styles.button} ${styles[local.variant ?? 'secondary']} ${local.class ?? ''}`}
      {...rest}
    />
  )
}
