import { defineNuxtModule, addPlugin, createResolver, addImports, addComponent } from '@nuxt/kit'
// Module options TypeScript interface definition
export interface ModuleOptions {}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'my-module',
    configKey: 'myModule'
  },
  // Default configuration options of the Nuxt module
  defaults: {},
  setup (options, nuxt) {


    const resolver = createResolver(import.meta.url)

    // Do not add the extension since the `.ts` will be transpiled to `.mjs` after `npm run prepack`
    addPlugin(resolver.resolve('./runtime/plugin'))
    // addImports({
    //   name: 'useForm', // name of the composable to be used
    //   as: 'useForm', 

    //   from: resolver.resolve('@formstate/core') // path of composable 
    // })
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: '@formstate/core' })
    })
    // addComponent({
    //   name: 'Input',
    //   export: 'Input',
    //   filePath: '@formstate/core',
    //   chunkName: '@formstate/core',
    // })

  }
})
