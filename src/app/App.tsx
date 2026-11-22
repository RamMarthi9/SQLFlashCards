import { loadCatalog, type Catalog } from '../content/catalog'
import { AccountApp } from './accounts/AccountApp'
export { LearningApp } from './LearningApp'

export default function App({ loadContent = loadCatalog }: { loadContent?: () => Catalog }) {
  return <AccountApp loadContent={loadContent} />
}
