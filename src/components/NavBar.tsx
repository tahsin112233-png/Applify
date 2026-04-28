import { navStore, setNavStore, t } from "@stores";
import { setDrawer } from "@utils";

export default function () {
  return (
    <nav>
      <button
        class="nav-tab"
        classList={{ active: navStore.queue.state }}
        aria-label={t('nav_queue')}
        onclick={() => {
          setNavStore('queue', 'state', !navStore.queue.state);
        }}
      >
        <i class={navStore.queue.state ? 'ri-order-play-fill' : 'ri-order-play-line'}></i>
        <span>Queue</span>
      </button>

      <button
        class="nav-tab"
        classList={{ active: navStore.search.state }}
        aria-label={t('nav_search')}
        onclick={() => {
          const state = !navStore.search.state;
          setNavStore('search', 'state', state);
          if (state) {
            setNavStore('library', 'state', false);
            navStore.search.ref?.scrollIntoView();
            setDrawer('lastMainFeature', 'search');
          }
        }}
      >
        <i class={navStore.search.state ? 'ri-search-2-fill' : 'ri-search-2-line'}></i>
        <span>Search</span>
      </button>

      <button
        class="nav-tab"
        classList={{ active: navStore.library.state }}
        aria-label={t('nav_library')}
        onclick={() => {
          const state = !navStore.library.state;
          setNavStore('library', 'state', state);
          if (state) {
            setNavStore('search', 'state', false);
            navStore.library.ref?.scrollIntoView();
            setDrawer('lastMainFeature', 'library');
          }
        }}
      >
        <i class={navStore.library.state ? 'ri-archive-stack-fill' : 'ri-archive-stack-line'}></i>
        <span>Library</span>
      </button>
    </nav>
  );
}
