import { logoPath } from '@freesewing/config'

export const logoDefs = [
  {
    name: 'logo',
    def: (scale) =>
      `<g id="logo" transform="scale(${scale}) translate(-21 -22)"><path class="logo" fill="#D07D7A" d="${logoPath}"/></g>`,
  },
]
