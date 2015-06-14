<?php if(!defined('KIRBY')) exit ?>

title: Product
pages: false
fields:
  title:
    label: Title
    type:  text
  price:
    label: Preis
    type:  number
    step: 0.01
  description:
    label: Beschreibung
    type:  textarea
  selector:
    label: Bestelloptionen
    type: radio
    default: size
    options:
      size: Größe
      amount: Menge
