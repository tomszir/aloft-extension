import logo from '../../../assets/brand/logo.svg'
import styles from './logo.module.css'

export interface LogoProps {
  /** Leave out where the text next to it already says "Aloft". */
  label?: string
}

export function Logo(props: LogoProps) {
  return <img class={styles.logo} src={logo} alt={props.label ?? ''} draggable={false} />
}
